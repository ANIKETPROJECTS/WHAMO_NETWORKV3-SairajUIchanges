// import { WhamoNode, WhamoEdge, useNetworkStore } from './store';
// import { saveAs } from 'file-saver';

// export function generateInpFile(nodes: WhamoNode[], edges: WhamoEdge[]) {
//   const state = useNetworkStore.getState();
//   const lines: string[] = [];

//   // Helper to add line
//   const add = (str: string) => lines.push(str);
//   const addComment = (comment?: string) => {
//     if (comment) {
//       add(`c ${comment}`);
//     }
//   };

//   const addL = (str: string) => lines.push(str);

//   addL('c Project Name');
//   addL('C  SYSTEM CONNECTIVITY');
//   addL('');
//   addL('SYSTEM');
//   addL('');

//   // Connectivity section
//   const visitedNodes = new Set<string>();
//   const visitedEdges = new Set<string>();
//   const connectivityLines: string[] = [];
//   const nodeIdsWithSpecialElements = new Set<string>();

//   function traverse(nodeId: string) {
//     if (visitedNodes.has(nodeId)) return;
//     visitedNodes.add(nodeId);

//     const node = nodes.find(n => n.id === nodeId);
//     if (!node) return;

//     const actualNodeId = node.data.nodeNumber?.toString() || node.id;

//     // Elements AT this node
//     if (node.type === 'reservoir' || node.type === 'surgeTank' || node.type === 'flowBoundary') {
//       connectivityLines.push(`ELEM ${node.data.label} AT ${actualNodeId}`);
//       nodeIdsWithSpecialElements.add(actualNodeId);
//     }

//     // Outgoing edges
//     const outgoingEdges = edges.filter(e => e.source === nodeId);

//     if (outgoingEdges.length > 0) {
//       if (node.type === 'junction' || outgoingEdges.length > 1) {
//         connectivityLines.push('');
//         connectivityLines.push(`JUNCTION AT ${actualNodeId}`);
//         connectivityLines.push('');
//         nodeIdsWithSpecialElements.add(actualNodeId);
//       }

//       outgoingEdges.forEach(edge => {
//         if (visitedEdges.has(edge.id)) return;
//         visitedEdges.add(edge.id);

//         const toNode = nodes.find(n => n.id === edge.target);
//         const toId = toNode?.data.nodeNumber?.toString() || toNode?.id || edge.target;
//         const fromId = actualNodeId;

//         connectivityLines.push(`ELEM ${edge.data?.label || edge.id} LINK ${fromId} ${toId}`);
//         traverse(edge.target);
//       });
//     }
//   }

//   // Start traversal from reservoirs
//   const reservoirs = nodes.filter(n => n.type === 'reservoir');
//   reservoirs.forEach(r => traverse(r.id));

//   // Handle any disconnected components (e.g. ST, FB if not reached by traversal)
//   nodes.forEach(n => {
//     if (!visitedNodes.has(n.id)) {
//       if (n.type === 'surgeTank' || n.type === 'flowBoundary') {
//         const actualNodeId = n.data.nodeNumber?.toString() || n.id;
//         connectivityLines.push(`ELEM ${n.data.label} AT ${actualNodeId}`);
//         nodeIdsWithSpecialElements.add(actualNodeId);
//       }
//     }
//   });

//   connectivityLines.forEach(line => addL(line));

//   // NODE Selection Algorithm according to Comprehensive Guide
//   const nodesToInclude = new Set<string>();

//   // 1. Prepare data structures for analysis
//   const nodeConnections: Record<string, { incoming: { elemId: string, edge: WhamoEdge }[], outgoing: { elemId: string, edge: WhamoEdge }[] }> = {};
//   const specialElementNodes = new Set<string>(); // A1, A3, A4
//   const junctionNodes = new Set<string>(); // A2
//   const nodesInOutputRequests = new Set<string>(); // B2

//   // Identify nodes with special elements (A1, A3, A4)
//   nodes.forEach(node => {
//     const actualNodeId = node.data.nodeNumber?.toString() || node.id;
//     if (node.type === 'reservoir' || node.type === 'surgeTank' || node.type === 'flowBoundary') {
//       specialElementNodes.add(actualNodeId);
//     }
//     if (node.type === 'junction') {
//       junctionNodes.add(actualNodeId);
//     }
//   });

//   // Build connection map
//   edges.forEach(edge => {
//     const fromNode = nodes.find(n => n.id === edge.source);
//     const toNode = nodes.find(n => n.id === edge.target);
//     if (!fromNode || !toNode) return;

//     const fromId = fromNode.data.nodeNumber?.toString() || fromNode.id;
//     const toId = toNode.data.nodeNumber?.toString() || toNode.id;
//     const elemId = edge.data?.label || edge.id;

//     if (!nodeConnections[fromId]) nodeConnections[fromId] = { incoming: [], outgoing: [] };
//     if (!nodeConnections[toId]) nodeConnections[toId] = { incoming: [], outgoing: [] };

//     nodeConnections[fromId].outgoing.push({ elemId, edge });
//     nodeConnections[toId].incoming.push({ elemId, edge });
//   });

//   // Identify nodes in output requests (B2)
//   state.outputRequests.forEach(req => {
//     if (req.elementType === 'node') {
//       const node = nodes.find(n => n.id === req.elementId);
//       if (node) {
//         nodesInOutputRequests.add(node.data.nodeNumber?.toString() || node.id);
//       }
//     }
//   });

//   // 2. Apply Rules
//   const allActualNodeIds = new Set([
//     ...nodes.map(n => n.data.nodeNumber?.toString() || n.id),
//     ...Array.from(specialElementNodes)
//   ]);

//   allActualNodeIds.forEach(nodeId => {
//     const connections = nodeConnections[nodeId] || { incoming: [], outgoing: [] };
//     const node = nodes.find(n => (n.data.nodeNumber?.toString() || n.id) === nodeId);
//     if (!node) return;

//     // --- CATEGORY A: MANDATORY ---

//     // A1, A3, A4: Special Elements
//     if (specialElementNodes.has(nodeId)) {
//       nodesToInclude.add(nodeId);
//       return;
//     }

//     // A2: Junctions (explicit or by connectivity)
//     if (junctionNodes.has(nodeId) || connections.incoming.length + connections.outgoing.length > 2) {
//       nodesToInclude.add(nodeId);
//       return;
//     }

//     // A5: First node after reservoir
//     const isFirstAfterReservoir = connections.incoming.some(inc => {
//       const sourceNodeId = nodes.find(n => n.id === inc.edge.source)?.data.nodeNumber?.toString() || inc.edge.source;
//       return specialElementNodes.has(sourceNodeId) && nodes.find(n => n.id === inc.edge.source)?.type === 'reservoir';
//     });
//     if (isFirstAfterReservoir) {
//       nodesToInclude.add(nodeId);
//       return;
//     }

//     // --- CATEGORY B: CONDITIONAL ---

//     // B2: Output requests
//     if (nodesInOutputRequests.has(nodeId)) {
//       nodesToInclude.add(nodeId);
//       return;
//     }

//     // B1: Major transitions (diameter change etc)
//     if (connections.incoming.length === 1 && connections.outgoing.length === 1) {
//       const inEdge = connections.incoming[0].edge;
//       const outEdge = connections.outgoing[0].edge;
//       if (inEdge.data?.diameter !== outEdge.data?.diameter ||
//           inEdge.data?.celerity !== outEdge.data?.celerity ||
//           inEdge.data?.friction !== outEdge.data?.friction) {
//         nodesToInclude.add(nodeId);
//         return;
//       }
//     }

//     // B3: Branch start/end nodes
//     // Covered by junction check A2 usually, but adding for completeness if a branch doesn't have >2 connections but is a split
//     if (connections.outgoing.length > 1 || connections.incoming.length > 1) {
//       nodesToInclude.add(nodeId);
//       return;
//     }

//     // --- CATEGORY C: SKIP ---
//     // If we reach here, it's likely an intermediate node (C1) or through-flow (C4) or dummy only (C2)
//   });

//   addL('');
//   const sortedNodeIds = Array.from(nodesToInclude).sort((a, b) => {
//     const numA = parseInt(a);
//     const numB = parseInt(b);
//     if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
//     return a.localeCompare(b);
//   });

//   sortedNodeIds.forEach(id => {
//     const node = nodes.find(n => (n.data.nodeNumber?.toString() || n.id) === id);
//     if (node && node.data.elevation !== undefined) {
//       const elev = typeof node.data.elevation === 'number' ? node.data.elevation.toFixed(1) : parseFloat(node.data.elevation).toFixed(1);
//       addL(`    NODE ${id} ELEV ${elev}`);
//     }
//   });

//   addL('');
//   addL('FINISH');
//   addL('');
//   addL('C ELEMENT PROPERTIES');
//   addL('');

//   // Properties Section
//   const exportedConduitLabels = new Set<string>();

//   nodes.filter(n => n.type === 'reservoir').forEach(n => {
//     addComment(n.data.comment);
//     addL('RESERVOIR');
//     addL(` ID ${n.data.label}`);
//     addL(` ELEV ${n.data.elevation}`);
//     addL(' FINISH');
//     addL('');
//   });

//   edges.filter(e => e.data?.type === 'conduit').forEach(e => {
//     const d = e.data;
//     if (!d) return;

//     const label = d.label || e.id;
//     if (exportedConduitLabels.has(label)) return;
//     exportedConduitLabels.add(label);

//     addComment(d.comment);
//     addL('CONDUIT');
//     addL(` ID ${label}`);

//     if (d.variable) {
//       addL(' VARIABLE');
//       if (d.distance !== undefined) addL(` DISTANCE ${d.distance}`);
//       if (d.area !== undefined) addL(` AREA ${d.area}`);
//       if (d.d !== undefined) addL(` D ${d.d}`);
//       if (d.a !== undefined) addL(` A ${d.a}`);
//     }

//     addL(` LENGTH ${d.length}`);
//     if (!d.variable) {
//       addL(` DIAM ${d.diameter}`);
//     }
//     addL(` CELERITY ${d.celerity}`);
//     addL(` FRICTION ${d.friction}`);

//     if (d.cplus !== undefined || d.cminus !== undefined) {
//       addL(' ADDEDLOSS');
//       if (d.cplus !== undefined) addL(`     CPLUS ${d.cplus.toFixed(2)}`);
//       if (d.cminus !== undefined) addL(`     CMINUS ${d.cminus.toFixed(2)}`);
//     }

//     if (d.numSegments !== undefined) {
//       addL(` NUMSEG ${d.numSegments}`);
//     }
//     addL('FINISH');
//     addL('');
//   });

//   edges.filter(e => e.data?.type === 'dummy').forEach(e => {
//     const d = e.data;
//     if (!d) return;
//     addComment(d.comment);
//     addL(`CONDUIT ID ${d.label || e.id} `);
//     addL(' DUMMY ');
//     addL(` DIAMETER ${d.diameter}`);
//     addL(' ADDEDLOSS ');
//     if (d.cplus !== undefined) addL(` CPLUS ${d.cplus}`);
//     if (d.cminus !== undefined) addL(` CMINUS ${d.cminus}`);
//     addL('FINISH');
//     addL('');
//   });

//   nodes.filter(n => n.type === 'surgeTank').forEach(n => {
//     const d = n.data;
//     if (!d) return;
//     addComment(d.comment);
//     addL('SURGETANK ');
//     addL(` ID ${d.label} SIMPLE`);
//     addL(` ELTOP ${d.topElevation}`);
//     addL(` ELBOTTOM ${d.bottomElevation}`);
//     addL(` DIAM ${d.diameter}`);
//     addL(` CELERITY ${d.celerity}`);
//     addL(` FRICTION ${d.friction}`);
//     addL('FINISH');
//     addL('');
//   });

//   nodes.filter(n => n.type === 'flowBoundary').forEach(n => {
//     const d = n.data;
//     if (!d) return;
//     addComment(d.comment);
//     addL(`FLOWBC ID ${d.label} QSCHEDULE ${d.scheduleNumber} FINISH`);
//   });

//   addL('');
//   addL('');
//   addL('SCHEDULE');

//   const flowBoundaries = nodes.filter(n => n.type === 'flowBoundary');
//   flowBoundaries.forEach(n => {
//     const d = n.data;
//     let schedule = '';
//     if (d.schedulePoints && Array.isArray(d.schedulePoints) && d.schedulePoints.length > 0) {
//       schedule = d.schedulePoints.map((p: any) => `T ${p.time} Q ${p.flow}`).join(' ');
//     } else {
//       schedule = 'T 0 Q 3000 T 20 Q 0 T 3000 Q 0';
//     }
//     addL(` QSCHEDULE ${d.scheduleNumber} ${schedule}`);
//   });

//   addL('');
//   addL('FINISH');
//   addL('');
//   addL('');
//   addL('C OUTPUT REQUEST');
//   addL('');

//   const requestsByType = state.outputRequests.reduce((acc, req) => {
//     if (!acc[req.requestType]) acc[req.requestType] = [];
//     acc[req.requestType].push(req);
//     return acc;
//   }, {} as Record<string, typeof state.outputRequests>);

//   const requestTypes = Object.keys(requestsByType);

//   if (requestTypes.length > 0) {
//     requestTypes.forEach(type => {
//       addL(type);
//       requestsByType[type].forEach(req => {
//         const element = req.elementType === 'node'
//           ? nodes.find(n => n.id === req.elementId)
//           : edges.find(e => e.id === req.elementId);

//         const isSurgeTank = req.elementType === 'node' && element?.data?.type === 'surgeTank';
//         const label = isSurgeTank
//           ? (element?.data?.label || element?.id || req.elementId)
//           : (element?.data?.nodeNumber || element?.data?.label || element?.id || req.elementId);
//         const typeStr = isSurgeTank ? 'ELEM' : 'NODE';
//         addL(` ${typeStr} ${label} ${req.variables.join(' ')}`);
//       });
//       addL(' FINISH');
//       addL('');
//     });

//     if (requestTypes.length > 1) {
//       addL(' DISPLAY');
//       addL('  ALL');
//       addL(' FINISH');
//       addL('');
//     }
//   } else {
//     addL('HISTORY');
//     addL(' NODE 2 Q HEAD');
//     addL(' ELEM ST Q ELEV');
//     addL(' FINISH');
//   }
//   addL('');
//   addL('');
//   addL('C COMPUTATIONAL PARAMETERS');
//   addL('CONTROL');
//   const cp = state.computationalParams;
//   addL(` DTCOMP ${cp.dtcomp} DTOUT ${cp.dtout} TMAX ${cp.tmax}`);
//   addL('FINISH');
//   addL('');
//   addL('C EXECUTION CONTROL');
//   addL('GO');
//   addL('GOODBYE');

//   const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
//   saveAs(blob, `network_${Date.now()}.inp`);
// }

////////////////////////////////////////

import { WhamoNode, WhamoEdge, useNetworkStore } from "./store";
import { saveAs } from "file-saver";

export function generateInpFile(nodes: WhamoNode[], edges: WhamoEdge[]) {
  const state = useNetworkStore.getState();
  const lines: string[] = [];

  const addL = (str: string = "") => lines.push(str);

  /* --------------------------------------------------------------------- */
  /* HELPERS                                                               */
  /* --------------------------------------------------------------------- */

  const getActualNodeId = (internalId: string): string => {
    const node = nodes.find((n) => n.id === internalId);
    return node?.data.nodeNumber?.toString() || internalId;
  };

  const getElevation = (nodeId: string): number | null => {
    const node = nodes.find((n) => getActualNodeId(n.id) === nodeId);
    if (!node || node.data.elevation === undefined) return null;

    return typeof node.data.elevation === "number"
      ? node.data.elevation
      : parseFloat(node.data.elevation);
  };

  const isSpecialNode = (nodeId: string): boolean => {
    const node = nodes.find((n) => getActualNodeId(n.id) === nodeId);
    if (!node) return false;

    return (
      node.type === "reservoir" ||
      node.type === "junction" ||
      node.type === "flowBoundary" ||
      node.type === "surgeTank"
    );
  };

  /* --------------------------------------------------------------------- */
  /* CONNECTION MAP                                                        */
  /* --------------------------------------------------------------------- */

  const nodeConnections: Record<
    string,
    { incoming: WhamoEdge[]; outgoing: WhamoEdge[] }
  > = {};

  nodes.forEach((node) => {
    nodeConnections[getActualNodeId(node.id)] = { incoming: [], outgoing: [] };
  });

  edges.forEach((edge) => {
    const fromId = getActualNodeId(edge.source);
    const toId = getActualNodeId(edge.target);

    if (!nodeConnections[fromId])
      nodeConnections[fromId] = { incoming: [], outgoing: [] };
    if (!nodeConnections[toId])
      nodeConnections[toId] = { incoming: [], outgoing: [] };

    nodeConnections[fromId].outgoing.push(edge);
    nodeConnections[toId].incoming.push(edge);
  });

  /* --------------------------------------------------------------------- */
  /* NODE SELECTION (CHAIN SKIPPING LOGIC)                                 */
  /* --------------------------------------------------------------------- */

  const nodesToInclude = new Set<string>();

  Object.keys(nodeConnections).forEach((nodeId) => {
    const conns = nodeConnections[nodeId];

    /* ALWAYS KEEP SPECIAL NODES */
    if (isSpecialNode(nodeId)) {
      nodesToInclude.add(nodeId);
      return;
    }

    /* KEEP TRUE JUNCTIONS BY CONNECTIVITY */
    if (conns.incoming.length > 1 || conns.outgoing.length > 1) {
      nodesToInclude.add(nodeId);
      return;
    }

    /* SERIAL NODE → CHECK CHAIN RULE */
    if (conns.incoming.length === 1 && conns.outgoing.length === 1) {
      const inEdge = conns.incoming[0];
      const outEdge = conns.outgoing[0];

      const inType = inEdge.data?.type || "conduit";
      const outType = outEdge.data?.type || "conduit";

      const inLabel = inEdge.data?.label;
      const outLabel = outEdge.data?.label;

      const isPureChain =
        inType === "conduit" &&
        outType === "conduit" &&
        inLabel &&
        outLabel &&
        inLabel === outLabel;

      if (!isPureChain) {
        nodesToInclude.add(nodeId);
      }

      return;
    }

    /* DEAD-END / OTHER → KEEP */
    nodesToInclude.add(nodeId);
  });

  /* FORCE INCLUDE OUTPUT REQUEST NODES */
  state.outputRequests.forEach((req) => {
    if (req.elementType === "node") {
      const node = nodes.find((n) => n.id === req.elementId);
      if (node) {
        nodesToInclude.add(getActualNodeId(node.id));
      }
    }
  });

  /* --------------------------------------------------------------------- */
  /* HEADER                                                                */
  /* --------------------------------------------------------------------- */

  addL("c Project Name");
  addL("C  SYSTEM CONNECTIVITY");
  addL("");
  addL("SYSTEM");
  addL("");

  /* --------------------------------------------------------------------- */
  /* CONNECTIVITY                                                          */
  /* --------------------------------------------------------------------- */

  const visitedEdges = new Set<string>();

  nodes.forEach((node) => {
    const nodeId = getActualNodeId(node.id);

    if (
      node.type === "reservoir" ||
      node.type === "surgeTank" ||
      node.type === "flowBoundary"
    ) {
      addL(`ELEM ${node.data.label} AT ${nodeId}`);
    }
  });

  edges.forEach((edge) => {
    if (visitedEdges.has(edge.id)) return;
    visitedEdges.add(edge.id);

    const fromId = getActualNodeId(edge.source);
    const toId = getActualNodeId(edge.target);
    const label = edge.data?.label || edge.id;

    addL(`ELEM ${label} LINK ${fromId} ${toId}`);
  });

  addL("");

  /* --------------------------------------------------------------------- */
  /* NODE ELEVATIONS                                                       */
  /* --------------------------------------------------------------------- */

  Array.from(nodesToInclude)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach((nodeId) => {
      const elev = getElevation(nodeId);

      if (elev !== null) {
        addL(`    NODE ${nodeId} ELEV ${elev.toFixed(1)}`);
      }
    });

  addL("");
  addL("FINISH");
  addL("");

  /* --------------------------------------------------------------------- */
  /* EXECUTION CONTROL                                                     */
  /* --------------------------------------------------------------------- */

  addL("C EXECUTION CONTROL");
  addL("GO");
  addL("GOODBYE");

  const blob = new Blob([lines.join("\n")], {
    type: "text/plain;charset=utf-8",
  });
  saveAs(blob, `network_${Date.now()}.inp`);
}
