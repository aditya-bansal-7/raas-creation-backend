import { Request, Response, NextFunction, Router } from "express";
import { prisma } from "../utils/prismaclient.js";
import { TimelineEventType } from "@prisma/client";


const WebhookRouter = Router();

const NimbusStatusMap: Record<string, {
  timelineLabel: string;
  type: TimelineEventType;
  fulfillment?: "SHIPPED" | "DELIVERED" | "RETURNED" | "CANCELLED";
}> = {
  "booked":            { timelineLabel: "Processing", type: "INFO" },
  "pending pickup":    { timelineLabel: "Processing", type: "INFO" },
  "in transit":        { timelineLabel: "Shipped", type: "INFO", fulfillment: "SHIPPED" },
  "exception":         { timelineLabel: "Delivery Issue", type: "WARNING" },
  "out for delivery":  { timelineLabel: "Out for Delivery", type: "INFO" },
  "delivered":         { timelineLabel: "Delivered", type: "SUCCESS", fulfillment: "DELIVERED" },
  "rto in transit":    { timelineLabel: "RTO In Transit", type: "WARNING", fulfillment: "RETURNED" },
  "rto delivered":     { timelineLabel: "RTO Delivered", type: "ERROR", fulfillment: "RETURNED" },
  "cancelled":         { timelineLabel: "Cancelled", type: "ERROR", fulfillment: "CANCELLED" },
};

WebhookRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  console.log("✅ Webhook Received");

  try {
    const payload = req.body;
    console.log("Webhook Payload:", payload);

    const {
      order_number,
      awb_number,
      status,
      status_code,
      message,
      event_time,
      location,
      courier_name,
      payment_type,
      edd,
    } = payload;

    if( order_number.startsWith("SI")){
      console.log("Skipping Nimbus webhook processing for SI order");
      res.status(200).send("Skipping Nimbus webhook processing for SI order");
      return;
    }

    // 1. Find the order by AWB number
    const order = await prisma.order.findUnique({
      where: { id: order_number },
    });

    if (!order) {
      console.warn(`⚠️ Order not found for orderID: ${order_number}`);
      res.status(404).send("Order not found");
      return;
    }

    const mapEntry = NimbusStatusMap[status?.toLowerCase() ?? ""];
    if (!mapEntry) {
      console.warn(`⚠️ Unknown status received: ${status}`);
    }

    if(!order.awb) {
      await prisma.order.update({
        where: { id: order.id },
        data: { awb: awb_number },
      });
    }

    if(!order.etd) {
      await prisma.order.update({
        where: { id: order.id },
        data: { etd: edd },
      });
    }

    // 2. Save the event to NimbusPostEvent
    await prisma.nimbusPostEvent.create({
      data: {
        orderId: order.id,
        awbNumber: awb_number,
        status,
        statusCode: status_code,
        message,
        eventTime: new Date(event_time),
        location,
        courierName: courier_name,
        paymentType: payment_type,
        edd: edd ? new Date(edd) : undefined,
        rawPayload: payload,
      },
    });

    // 3. Add entry to ShipmentTimeline (if status recognized)
    if (mapEntry) {
      await prisma.shipmentTimeline.create({
        data: {
          orderId: order.id,
          label: mapEntry.timelineLabel,
          note: message || undefined,
          timestamp: new Date(event_time),
          type: mapEntry.type,
        },
      });

      // 4. Optionally update order status/fulfillment
      await prisma.order.update({
        where: { id: order.id },
        data: {
          fulfillment: mapEntry.fulfillment || order.fulfillment,
          DeliveryStatus: status.toUpperCase(),
          deliveredAt:
            mapEntry.fulfillment === "DELIVERED"
              ? new Date(event_time)
              : order.deliveredAt,
          etd: edd ? edd.toString() : order.etd,
        },
      });
    }

    res.status(200).send("Webhook received and processed");
  } catch (err) {
    console.error("❌ Error processing webhook:", err);
    res.status(500).send("Internal Server Error");
  }
});

export default WebhookRouter;
// Prisma error handling middleware (for Prisma-related errors)
// WebhookRouter.use((err: any, req: Request, res: Response, next: NextFunction) => {
//   if (err instanceof prisma.PrismaClientKnownRequestError) {
//     console.error("Prisma error:", err.message);
//     res.status(400).send("Prisma error occurred");
//   } else {
//     next(err);
//   }
// });

// import { orderDeliverd, orderOutforDelivery, orderShipped } from "../utils/whatsappclient.js";

// try {
//   const { order_id, awb, etd, current_status } = req.body;

//   if (!order_id) {
//     res.status(400).json({ success: false, message: "Missing order_id" });
//     return;
//   }

//   const order = await prisma.order.findUnique({
//     where: { id: order_id },
//     include: { user: true, items: true },
//   });

//   if (!order) {
//     res.status(404).json({ success: false, message: "Order not found" });
//     return;
//   }

//   let updateData: Record<string, any> = {};

//   if (!order.awb && awb) updateData.awb = awb;
//   if (!order.etd || order.etd !== etd) updateData.etd = etd;

//   if (order.DeliveryStatus !== current_status) {
//     switch (current_status.toUpperCase()) {
//       case "DELIVERED":
//         updateData.status = "COMPLETED";
//         updateData.deliveredAt = new Date();
//         orderDeliverd(order.user?.name ?? "Customer", order.items[0]?.productName ?? "your order", "Thank You", order.user?.mobile_no ?? "");
//         break;
//       case "CANCELED":
//         updateData.status = "CANCELLED";
//         updateData.deliveredAt = new Date();
//         break;
//       case "OUT FOR DELIVERY":
//         orderOutforDelivery(order.user?.name ?? "Customer", order.items[0]?.productName ?? "your order", "Thank You", "", order.user?.mobile_no ?? "");
//         break;
//       case "SHIPPED":
//         updateData.status = "PENDING";
//         orderShipped(order.user?.name ?? "Customer", order.items[0]?.productName ?? "your order", "Thank You", "", order.user?.mobile_no ?? "");
//         break;
//     }
//   }

//   updateData.DeliveryStatus = current_status;

//   await prisma.order.update({
//     where: { id: order_id },
//     data: updateData,
//   });

//   res.status(200).json({ success: true });
// } catch (error) {
//   console.error("Error processing webhook:", error);
//   res.status(500).json({ success: false, message: "Internal Server Error" });
// }