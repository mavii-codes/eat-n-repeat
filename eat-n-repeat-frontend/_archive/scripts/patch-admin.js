const fs = require('fs');
const p = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/context/AdminDataContext.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  'updateDeliveryStatus: (id: string, status: DeliveryStatus) => void;',
  'updateDeliveryStatus: (id: string, status: DeliveryStatus) => void;\n  updateDeliveryPerson: (id: string, person: "Delivery Rider" | "Café Owner") => void;'
);

c = c.replace(
  'const addDeliveryOrder = useCallback((input: DeliveryOrderInput) => {\n    setData((prev) => ({\n      ...prev,\n      deliveryOrders: [\n        { ...input, id: createId("do"), archived: false },\n        ...prev.deliveryOrders,\n      ],\n    }));\n  }, []);',
  'const addDeliveryOrder = useCallback((input: DeliveryOrderInput) => {\n    const day = new Date().getDay();\n    const isWeekend = day === 0 || day === 6;\n    const deliveryPerson = isWeekend ? "Delivery Rider" : "Café Owner";\n    setData((prev) => ({\n      ...prev,\n      deliveryOrders: [\n        { ...input, id: createId("do"), archived: false, deliveryPerson },\n        ...prev.deliveryOrders,\n      ],\n    }));\n  }, []);'
);

c = c.replace(
  'const updateDeliveryStatus = useCallback(\n    (id: string, status: DeliveryStatus) => {',
  'const updateDeliveryPerson = useCallback(\n    (id: string, person: "Delivery Rider" | "Café Owner") => {\n      setData((prev) => ({\n        ...prev,\n        deliveryOrders: prev.deliveryOrders.map((order) =>\n          order.id === id ? { ...order, deliveryPerson: person } : order\n        ),\n      }));\n    },\n    []\n  );\n\n  const updateDeliveryStatus = useCallback(\n    (id: string, status: DeliveryStatus) => {'
);

c = c.replace(
  'updateDeliveryStatus,\n      archiveDeliveryOrder,',
  'updateDeliveryStatus,\n      updateDeliveryPerson,\n      archiveDeliveryOrder,'
);

// We should also patch getActiveDeliveryOrders and getDeliveryHistory in the same file to add a fallback deliveryPerson if undefined
// so that mock orders have a delivery person automatically depending on the day.
c = c.replace(
  'const getActiveDeliveryOrders = useCallback(() => {\n    return data.deliveryOrders\n      .filter((order) => !order.archived && activeDeliveryStatuses.includes(order.status))\n      .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime());\n  }, [data.deliveryOrders]);',
  'const getActiveDeliveryOrders = useCallback(() => {\n    return data.deliveryOrders\n      .filter((order) => !order.archived && activeDeliveryStatuses.includes(order.status))\n      .map(order => order.deliveryPerson ? order : { ...order, deliveryPerson: (new Date().getDay() === 0 || new Date().getDay() === 6) ? "Delivery Rider" : "Café Owner" as "Delivery Rider" | "Café Owner" })\n      .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime());\n  }, [data.deliveryOrders]);'
);
c = c.replace(
  'const getDeliveryHistory = useCallback(() => {\n    return data.deliveryOrders\n      .filter((order) => !order.archived && historyDeliveryStatuses.includes(order.status))\n      .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime());\n  }, [data.deliveryOrders]);',
  'const getDeliveryHistory = useCallback(() => {\n    return data.deliveryOrders\n      .filter((order) => !order.archived && historyDeliveryStatuses.includes(order.status))\n      .map(order => order.deliveryPerson ? order : { ...order, deliveryPerson: (new Date().getDay() === 0 || new Date().getDay() === 6) ? "Delivery Rider" : "Café Owner" as "Delivery Rider" | "Café Owner" })\n      .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime());\n  }, [data.deliveryOrders]);'
);

fs.writeFileSync(p, c, 'utf8');
console.log('AdminDataContext updated.');
