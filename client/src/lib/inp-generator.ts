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

import { WhamoNode, WhamoEdge, useNetworkStore } from "./store";
import { saveAs } from "file-saver";

export function generateInpFile(nodes: WhamoNode[], edges: WhamoEdge[]) {
  const state = useNetworkStore.getState();
  const lines: string[] = [];

  // Helper to add line
  const add = (str: string) => lines.push(str);
  const addComment = (comment?: string) => {
    if (comment) {
      add(`c ${comment}`);
    }
  };

  const addL = (str: string) => lines.push(str);

  addL("c Project Name");
  addL("C  SYSTEM CONNECTIVITY");
  addL("");
  addL("SYSTEM");
  addL("");

  // ============================================================================
  // CONNECTIVITY SECTION
  // ============================================================================
  const visitedNodes = new Set<string>();
  const visitedEdges = new Set<string>();
  const connectivityLines: string[] = [];
  const nodeIdsWithSpecialElements = new Set<string>();

  function traverse(nodeId: string) {
    if (visitedNodes.has(nodeId)) return;
    visitedNodes.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const actualNodeId = node.data.nodeNumber?.toString() || node.id;

    // Elements AT this node
    if (
      node.type === "reservoir" ||
      node.type === "surgeTank" ||
      node.type === "flowBoundary"
    ) {
      connectivityLines.push(`ELEM ${node.data.label} AT ${actualNodeId}`);
      nodeIdsWithSpecialElements.add(actualNodeId);
    }

    // Outgoing edges
    const outgoingEdges = edges.filter((e) => e.source === nodeId);

    if (outgoingEdges.length > 0) {
      if (node.type === "junction" || outgoingEdges.length > 1) {
        connectivityLines.push("");
        connectivityLines.push(`JUNCTION AT ${actualNodeId}`);
        connectivityLines.push("");
        nodeIdsWithSpecialElements.add(actualNodeId);
      }

      outgoingEdges.forEach((edge) => {
        if (visitedEdges.has(edge.id)) return;
        visitedEdges.add(edge.id);

        const toNode = nodes.find((n) => n.id === edge.target);
        const toId =
          toNode?.data.nodeNumber?.toString() || toNode?.id || edge.target;
        const fromId = actualNodeId;

        connectivityLines.push(
          `ELEM ${edge.data?.label || edge.id} LINK ${fromId} ${toId}`,
        );
        traverse(edge.target);
      });
    }
  }

  // Start traversal from reservoirs
  const reservoirs = nodes.filter((n) => n.type === "reservoir");
  reservoirs.forEach((r) => traverse(r.id));

  // Handle any disconnected components
  nodes.forEach((n) => {
    if (!visitedNodes.has(n.id)) {
      if (n.type === "surgeTank" || n.type === "flowBoundary") {
        const actualNodeId = n.data.nodeNumber?.toString() || n.id;
        connectivityLines.push(`ELEM ${n.data.label} AT ${actualNodeId}`);
        nodeIdsWithSpecialElements.add(actualNodeId);
      }
    }
  });

  connectivityLines.forEach((line) => addL(line));

  // ============================================================================
  // NODE ELEVATION SELECTION - COMPREHENSIVE ALGORITHM
  // Following the detailed guide rules
  // ============================================================================

  // STEP 1: Parse and create data structures
  const nodesToInclude = new Set<string>();

  // Create mapping of internal ID to actual node number
  const getActualNodeId = (internalId: string): string => {
    const node = nodes.find((n) => n.id === internalId);
    return node?.data.nodeNumber?.toString() || internalId;
  };

  // Build comprehensive connection map
  interface Connection {
    elemId: string;
    elemType: string;
    edge: WhamoEdge;
    sourceNodeId: string;
    targetNodeId: string;
  }

  const nodeConnections: Record<
    string,
    {
      incoming: Connection[];
      outgoing: Connection[];
    }
  > = {};

  // Initialize connection map for all nodes
  nodes.forEach((node) => {
    const actualNodeId = getActualNodeId(node.id);
    if (!nodeConnections[actualNodeId]) {
      nodeConnections[actualNodeId] = { incoming: [], outgoing: [] };
    }
  });

  // Build connections from edges
  edges.forEach((edge) => {
    const fromNode = nodes.find((n) => n.id === edge.source);
    const toNode = nodes.find((n) => n.id === edge.target);
    if (!fromNode || !toNode) return;

    const fromId = getActualNodeId(edge.source);
    const toId = getActualNodeId(edge.target);
    const elemId = edge.data?.label || edge.id;
    const elemType = edge.data?.type || "conduit";

    if (!nodeConnections[fromId])
      nodeConnections[fromId] = { incoming: [], outgoing: [] };
    if (!nodeConnections[toId])
      nodeConnections[toId] = { incoming: [], outgoing: [] };

    const connection: Connection = {
      elemId,
      elemType,
      edge,
      sourceNodeId: fromId,
      targetNodeId: toId,
    };

    nodeConnections[fromId].outgoing.push(connection);
    nodeConnections[toId].incoming.push(connection);
  });

  // STEP 2: Identify special node categories
  const reservoirNodes = new Set<string>();
  const junctionNodes = new Set<string>();
  const boundaryNodes = new Set<string>();
  const surgeTankNodes = new Set<string>();
  const dummyOnlyNodes = new Set<string>();

  nodes.forEach((node) => {
    const actualNodeId = getActualNodeId(node.id);

    // A1: Reservoir nodes
    if (node.type === "reservoir") {
      reservoirNodes.add(actualNodeId);
    }

    // A2: Junction nodes
    if (node.type === "junction") {
      junctionNodes.add(actualNodeId);
    }

    // A3: Boundary condition nodes
    if (node.type === "flowBoundary") {
      boundaryNodes.add(actualNodeId);
    }

    // A4: Surge tank nodes
    if (node.type === "surgeTank") {
      surgeTankNodes.add(actualNodeId);
    }
  });

  // Identify nodes only connected to DUMMY elements (C2)
  Object.keys(nodeConnections).forEach((nodeId) => {
    const connections = nodeConnections[nodeId];
    const allConnections = [...connections.incoming, ...connections.outgoing];

    if (allConnections.length > 0) {
      const allDummy = allConnections.every(
        (conn) => conn.elemType === "dummy",
      );
      if (allDummy) {
        dummyOnlyNodes.add(nodeId);
      }
    }
  });

  // STEP 3: Apply CATEGORY A rules (MANDATORY - ALWAYS INCLUDE)

  // A1: Add all reservoir nodes
  reservoirNodes.forEach((nodeId) => {
    nodesToInclude.add(nodeId);
  });

  // A2: Add all junction nodes
  junctionNodes.forEach((nodeId) => {
    nodesToInclude.add(nodeId);
  });

  // A3: Add all boundary condition nodes
  boundaryNodes.forEach((nodeId) => {
    nodesToInclude.add(nodeId);
  });

  // A4: Add all surge tank nodes
  surgeTankNodes.forEach((nodeId) => {
    nodesToInclude.add(nodeId);
  });

  // A5: Add first nodes after each reservoir
  reservoirNodes.forEach((reservoirNodeId) => {
    const connections = nodeConnections[reservoirNodeId];
    if (connections && connections.outgoing.length > 0) {
      connections.outgoing.forEach((conn) => {
        // Add the immediate downstream node after reservoir
        nodesToInclude.add(conn.targetNodeId);
      });
    }
  });

  // STEP 4: Detect junctions by connectivity (not just explicit type)
  // A junction is also any node with more than 2 total connections
  Object.keys(nodeConnections).forEach((nodeId) => {
    const connections = nodeConnections[nodeId];
    const totalConnections =
      connections.incoming.length + connections.outgoing.length;

    // If more than 2 connections (1 in, 1 out), it's a junction
    if (totalConnections > 2) {
      nodesToInclude.add(nodeId);
      junctionNodes.add(nodeId); // Track as junction
    }

    // Special case: multiple outgoing OR multiple incoming = junction
    if (connections.outgoing.length > 1 || connections.incoming.length > 1) {
      nodesToInclude.add(nodeId);
      junctionNodes.add(nodeId);
    }
  });

  // STEP 5: Apply CATEGORY B rules (CONDITIONAL)

  // B1: Major transition nodes - where element type changes
  Object.keys(nodeConnections).forEach((nodeId) => {
    // Skip if already included
    if (nodesToInclude.has(nodeId)) return;

    const connections = nodeConnections[nodeId];

    // Check for element type change at this node
    if (
      connections.incoming.length === 1 &&
      connections.outgoing.length === 1
    ) {
      const inConn = connections.incoming[0];
      const outConn = connections.outgoing[0];

      // Different element IDs suggest different physical sections
      if (inConn.elemId !== outConn.elemId) {
        nodesToInclude.add(nodeId);
        return;
      }

      // Check for property changes (diameter, celerity, friction)
      const inEdge = inConn.edge;
      const outEdge = outConn.edge;

      if (inEdge.data && outEdge.data) {
        if (
          inEdge.data.diameter !== outEdge.data.diameter ||
          inEdge.data.celerity !== outEdge.data.celerity ||
          inEdge.data.friction !== outEdge.data.friction
        ) {
          nodesToInclude.add(nodeId);
          return;
        }
      }
    }

    // If multiple incoming or outgoing with different element types
    const incomingElemIds = new Set(connections.incoming.map((c) => c.elemId));
    const outgoingElemIds = new Set(connections.outgoing.map((c) => c.elemId));

    if (incomingElemIds.size > 1 || outgoingElemIds.size > 1) {
      nodesToInclude.add(nodeId);
      return;
    }
  });

  // B2: Nodes in output requests
  state.outputRequests.forEach((req) => {
    if (req.elementType === "node") {
      const node = nodes.find((n) => n.id === req.elementId);
      if (node) {
        const actualNodeId = getActualNodeId(node.id);
        nodesToInclude.add(actualNodeId);
      }
    }
  });

  // STEP 6: Apply CATEGORY C rules (EXCLUSIONS)

  // C2: Remove dummy-only nodes (unless they're junctions or special elements)
  dummyOnlyNodes.forEach((nodeId) => {
    // Only remove if NOT a junction, reservoir, boundary, or surge tank
    if (
      !junctionNodes.has(nodeId) &&
      !reservoirNodes.has(nodeId) &&
      !boundaryNodes.has(nodeId) &&
      !surgeTankNodes.has(nodeId)
    ) {
      nodesToInclude.delete(nodeId);
    }
  });

  // C1 & C4: Identify and remove intermediate nodes in chains
  // An intermediate node is one that:
  // - Has exactly 1 incoming and 1 outgoing connection
  // - Both connections use the same element ID
  // - Is not a junction, boundary, reservoir, or surge tank
  // - Is not a transition point
  Object.keys(nodeConnections).forEach((nodeId) => {
    const connections = nodeConnections[nodeId];

    // Must have exactly 1 in and 1 out
    if (
      connections.incoming.length !== 1 ||
      connections.outgoing.length !== 1
    ) {
      return;
    }

    const inConn = connections.incoming[0];
    const outConn = connections.outgoing[0];

    // Same element ID (same conduit/pipe)
    if (inConn.elemId === outConn.elemId) {
      // Not a special node
      if (
        !junctionNodes.has(nodeId) &&
        !reservoirNodes.has(nodeId) &&
        !boundaryNodes.has(nodeId) &&
        !surgeTankNodes.has(nodeId)
      ) {
        // This is an intermediate node - remove it
        nodesToInclude.delete(nodeId);
      }
    }
  });

  // STEP 7: Handle special case - nodes connected to dummy elements
  // but also connected to real elements should be kept
  dummyOnlyNodes.forEach((nodeId) => {
    const connections = nodeConnections[nodeId];
    const allConnections = [...connections.incoming, ...connections.outgoing];

    // Check if ANY connection is non-dummy
    const hasRealConnection = allConnections.some(
      (conn) => conn.elemType !== "dummy",
    );

    if (hasRealConnection) {
      // This node connects to real elements, check if it should be included
      if (
        junctionNodes.has(nodeId) ||
        reservoirNodes.has(nodeId) ||
        boundaryNodes.has(nodeId) ||
        surgeTankNodes.has(nodeId)
      ) {
        nodesToInclude.add(nodeId);
      }
    }
  });

  // STEP 8: Final validation - ensure no essential nodes are missing

  // Ensure all junction nodes are included (CRITICAL)
  junctionNodes.forEach((nodeId) => {
    if (!nodesToInclude.has(nodeId)) {
      console.warn(`Adding missing junction node: ${nodeId}`);
      nodesToInclude.add(nodeId);
    }
  });

  // Ensure all reservoir nodes are included (CRITICAL)
  reservoirNodes.forEach((nodeId) => {
    if (!nodesToInclude.has(nodeId)) {
      console.warn(`Adding missing reservoir node: ${nodeId}`);
      nodesToInclude.add(nodeId);
    }
  });

  // Ensure all boundary nodes are included (CRITICAL)
  boundaryNodes.forEach((nodeId) => {
    if (!nodesToInclude.has(nodeId)) {
      console.warn(`Adding missing boundary node: ${nodeId}`);
      nodesToInclude.add(nodeId);
    }
  });

  // Ensure all surge tank nodes are included (CRITICAL)
  surgeTankNodes.forEach((nodeId) => {
    if (!nodesToInclude.has(nodeId)) {
      console.warn(`Adding missing surge tank node: ${nodeId}`);
      nodesToInclude.add(nodeId);
    }
  });

  // ============================================================================
  // OUTPUT NODE ELEVATIONS
  // ============================================================================

  addL("");

  // Sort nodes in ascending numerical order
  const sortedNodeIds = Array.from(nodesToInclude).sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  // Output node elevations with proper formatting
  sortedNodeIds.forEach((nodeId) => {
    // Find the actual node object
    const node = nodes.find((n) => getActualNodeId(n.id) === nodeId);

    if (node && node.data.elevation !== undefined) {
      const elev =
        typeof node.data.elevation === "number"
          ? node.data.elevation.toFixed(1)
          : parseFloat(node.data.elevation).toFixed(1);
      addL(`    NODE ${nodeId} ELEV ${elev}`);
    } else {
      // Node not found or no elevation - this shouldn't happen but log warning
      console.warn(
        `Node ${nodeId} selected for elevation but has no elevation data`,
      );
    }
  });

  addL("");
  addL("FINISH");
  addL("");

  // ============================================================================
  // ELEMENT PROPERTIES SECTION
  // ============================================================================

  addL("C ELEMENT PROPERTIES");
  addL("");

  const exportedConduitLabels = new Set<string>();

  // Reservoirs
  nodes
    .filter((n) => n.type === "reservoir")
    .forEach((n) => {
      addComment(n.data.comment);
      addL("RESERVOIR");
      addL(` ID ${n.data.label}`);
      addL(` ELEV ${n.data.elevation}`);
      addL(" FINISH");
      addL("");
    });

  // Conduits
  edges
    .filter((e) => e.data?.type === "conduit")
    .forEach((e) => {
      const d = e.data;
      if (!d) return;

      const label = d.label || e.id;
      if (exportedConduitLabels.has(label)) return;
      exportedConduitLabels.add(label);

      addComment(d.comment);
      addL("CONDUIT");
      addL(` ID ${label}`);

      if (d.variable) {
        addL(" VARIABLE");
        if (d.distance !== undefined) addL(` DISTANCE ${d.distance}`);
        if (d.area !== undefined) addL(` AREA ${d.area}`);
        if (d.d !== undefined) addL(` D ${d.d}`);
        if (d.a !== undefined) addL(` A ${d.a}`);
      }

      addL(` LENGTH ${d.length}`);
      if (!d.variable && d.diameter !== undefined) {
        addL(` DIAM ${d.diameter}`);
      }
      if (d.celerity !== undefined) addL(` CELERITY ${d.celerity}`);
      if (d.friction !== undefined) addL(` FRICTION ${d.friction}`);

      if (d.cplus !== undefined || d.cminus !== undefined) {
        addL(" ADDEDLOSS");
        if (d.cplus !== undefined) addL(`     CPLUS ${d.cplus.toFixed(2)}`);
        if (d.cminus !== undefined) addL(`     CMINUS ${d.cminus.toFixed(2)}`);
      }

      if (d.numSegments !== undefined) {
        addL(` NUMSEG ${d.numSegments}`);
      }
      addL(" FINISH");
      addL("");
    });

  // Dummy conduits
  edges
    .filter((e) => e.data?.type === "dummy")
    .forEach((e) => {
      const d = e.data;
      if (!d) return;
      const label = d.label || e.id;
      if (exportedConduitLabels.has(label)) return;
      exportedConduitLabels.add(label);

      addComment(d.comment);
      addL("CONDUIT");
      addL(` ID ${label}`);
      addL(" DUMMY");
      if (d.diameter !== undefined) addL(` DIAM ${d.diameter}`);
      if (d.cplus !== undefined || d.cminus !== undefined) {
        addL(" ADDEDLOSS");
        if (d.cplus !== undefined) addL(`     CPLUS ${d.cplus}`);
        if (d.cminus !== undefined) addL(`     CMINUS ${d.cminus}`);
      }
      addL(" FINISH");
      addL("");
    });

  // Surge tanks
  nodes
    .filter((n) => n.type === "surgeTank")
    .forEach((n) => {
      const d = n.data;
      if (!d) return;
      addComment(d.comment);
      addL("SURGETANK");
      addL(` ID ${d.label} SIMPLE`);
      addL(` ELBOTTOM ${d.bottomElevation}`);
      addL(` ELTOP ${d.topElevation}`);
      addL(` DIAM ${d.diameter}`);
      addL(` CELERITY ${d.celerity}`);
      addL(` FRICTION ${d.friction}`);
      addL(" FINISH");
      addL("");
    });

  // Flow boundaries
  nodes
    .filter((n) => n.type === "flowBoundary")
    .forEach((n) => {
      const d = n.data;
      if (!d) return;
      addComment(d.comment);
      addL("FLOWBC");
      addL(` ID ${d.label}`);
      addL(` QSCHEDULE ${d.scheduleNumber}`);
      addL(" FINISH");
      addL("");
    });

  // ============================================================================
  // SCHEDULES SECTION
  // ============================================================================

  addL("C TURBINE CHARACTERISTICS");
  addL("");
  addL("SCHEDULE");
  addL("");

  const flowBoundaries = nodes.filter((n) => n.type === "flowBoundary");
  flowBoundaries.forEach((n) => {
    const d = n.data;
    addL(` QSCHEDULE ${d.scheduleNumber}`);

    if (
      d.schedulePoints &&
      Array.isArray(d.schedulePoints) &&
      d.schedulePoints.length > 0
    ) {
      d.schedulePoints.forEach((p: any) => {
        addL(`     T ${p.time} Q ${p.flow}`);
      });
    } else {
      // Default schedule
      addL("     T 0.0 Q 3000");
      addL("     T 20.0 Q 0");
      addL("     T 3000 Q 0");
    }
    addL(" FINISH");
    addL("");
  });

  addL("");

  // ============================================================================
  // OUTPUT REQUESTS SECTION
  // ============================================================================

  addL("C OUTPUT REQUESTS");
  addL("");

  const requestsByType = state.outputRequests.reduce(
    (acc, req) => {
      if (!acc[req.requestType]) acc[req.requestType] = [];
      acc[req.requestType].push(req);
      return acc;
    },
    {} as Record<string, typeof state.outputRequests>,
  );

  const requestTypes = Object.keys(requestsByType);

  if (requestTypes.length > 0) {
    requestTypes.forEach((type) => {
      addL(type);
      requestsByType[type].forEach((req) => {
        const element =
          req.elementType === "node"
            ? nodes.find((n) => n.id === req.elementId)
            : edges.find((e) => e.id === req.elementId);

        const isSurgeTank =
          req.elementType === "node" && element?.type === "surgeTank";
        const label = isSurgeTank
          ? element?.data?.label || element?.id || req.elementId
          : element?.data?.nodeNumber ||
            element?.data?.label ||
            element?.id ||
            req.elementId;
        const typeStr = isSurgeTank ? "ELEM" : "NODE";
        addL(` ${typeStr} ${label} ${req.variables.join(" ")}`);
      });
      addL(" FINISH");
      addL("");
    });

    if (requestTypes.length > 1) {
      addL(" DISPLAY");
      addL("  ALL");
      addL(" FINISH");
      addL("");
    }
  } else {
    // Default output requests
    addL(" HISTORY");
    addL("  NODE 2 Q HEAD");
    addL("  ELEM ST Q ELEV");
    addL(" FINISH");
    addL("");
  }

  // ============================================================================
  // COMPUTATIONAL PARAMETERS
  // ============================================================================

  addL("C COMPUTATIONAL PARAMETERS");
  addL(" CONTROL");
  const cp = state.computationalParams;
  addL(` DTCOMP ${cp.dtcomp} DTOUT ${cp.dtout} TMAX ${cp.tmax}`);
  addL(" FINISH");
  addL("");

  // ============================================================================
  // EXECUTION CONTROL
  // ============================================================================

  addL("C EXECUTION CONTROL");
  addL("GO");
  addL("GOODBYE");

  // Save file
  const blob = new Blob([lines.join("\n")], {
    type: "text/plain;charset=utf-8",
  });
  saveAs(blob, `network_${Date.now()}.inp`);
}
