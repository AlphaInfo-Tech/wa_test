// lib/ai/tool-handlers.js
// Each function here corresponds to a "tool" the model can call in generate.js.
// Replace the bodies with real calls to your order system, booking API, etc.

export async function executeToolCall(name, args) {
  switch (name) {
    case "lookup_order_status":
      return lookupOrderStatus(args.order_id);
    case "check_appointment_slots":
      return checkAppointmentSlots(args.date);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function lookupOrderStatus(orderId) {
  // TODO: replace with real call to Shopify/your order DB
  // const res = await fetch(`${process.env.ORDER_API_URL}/orders/${orderId}`);
  // return res.json();

  return {
    order_id: orderId,
    status: "out_for_delivery",
    estimated_delivery: "today by 7pm",
  };
}

async function checkAppointmentSlots(date) {
  // TODO: replace with real calendar/booking API call
  return {
    date,
    available_slots: ["10:00 AM", "2:30 PM", "4:00 PM"],
  };
}
