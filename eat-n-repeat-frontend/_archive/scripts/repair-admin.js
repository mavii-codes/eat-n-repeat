const fs = require('fs');
let file = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/context/AdminDataContext.tsx';
let c = fs.readFileSync(file, 'utf8');

const brokenTarget = `  const getStockItemsByCategory = useCallback(
      deliveryOrders: prev.deliveryOrders.filter((order) => order.id !== id),
    }));
  }, []);`;

const brokenTargetWindows = `  const getStockItemsByCategory = useCallback(\r\n      deliveryOrders: prev.deliveryOrders.filter((order) => order.id !== id),\r\n    }));\r\n  }, []);`;

const replacement = `  const getStockItemsByCategory = useCallback(
    (categoryId: string) =>
      data.stockItems.filter((item) => item.categoryId === categoryId),
    [data.stockItems],
  );

  const updateDeliveryStatus = useCallback(
    (id: string, status: DeliveryStatus) => {
      setData((prev) => ({
        ...prev,
        deliveryOrders: prev.deliveryOrders.map((order) =>
          order.id === id
            ? {
                ...order,
                status,
                deliveredAt:
                  status === "delivered"
                    ? new Date().toISOString()
                    : order.deliveredAt,
              }
            : order,
        ),
      }));
    },
    [],
  );

  const updateDeliveryPerson = useCallback(
    (id: string, person: "Delivery Rider" | "Café Owner") => {
      setData((prev) => ({
        ...prev,
        deliveryOrders: prev.deliveryOrders.map((order) =>
          order.id === id ? { ...order, deliveryPerson: person } : order
        ),
      }));
    },
    []
  );

  const addDeliveryOrder = useCallback((input: DeliveryOrderInput) => {
    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 6;
    const deliveryPerson = isWeekend ? "Delivery Rider" : "Café Owner";
    setData((prev) => ({
      ...prev,
      deliveryOrders: [
        { ...input, id: createId("do"), archived: false, deliveryPerson },
        ...prev.deliveryOrders,
      ],
    }));
  }, []);

  const deleteDeliveryOrder = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      deliveryOrders: prev.deliveryOrders.filter((order) => order.id !== id),
    }));
  }, []);`;

if (c.includes(brokenTarget)) {
  c = c.replace(brokenTarget, replacement);
  fs.writeFileSync(file, c, 'utf8');
  console.log('Fixed broken target properly.');
} else if (c.includes(brokenTargetWindows)) {
  c = c.replace(brokenTargetWindows, replacement.replace(/\n/g, '\r\n'));
  fs.writeFileSync(file, c, 'utf8');
  console.log('Fixed broken target with \\r\\n properly.');
} else {
  console.log('Could not find the target string!');
}
