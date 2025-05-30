import morgan from 'morgan';

import express, { Request, Response, NextFunction } from 'express';


import 'express-async-errors';

// import BaseRouter from '@src/routes';
import { authenticateJWT, globalErrorHandler } from './middleware/globalerrorhandler.js';

import ENV from './common/env.js';
import HttpStatusCodes from './common/httpstatuscode.js';
import { NodeEnvs } from './common/constants.js';
import cors from 'cors';
import cookieParser from 'cookie-parser'


/******************************************************************************
                                Setup
******************************************************************************/

const app = express();

// **** Middleware **** //

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Show routes called in console during development
if (ENV.NODE_ENV === NodeEnvs.Dev) {
  app.use(morgan('dev'));
}

// WebHook
import webhookRoutes from './routes/webhook.routes.js'


const healthCheck = express.Router();

healthCheck.get("/", (req: Request, res: Response) => {
  res.status(HttpStatusCodes.OK).json({
    success: true,
    message: "Server is running",
  });
});


app.use("/api/webhook", webhookRoutes);

app.use("/api/health", healthCheck);


//CORS
const whitelist = [ENV.FRONTENDURL];
const corsOptions = {
  origin: ENV.FRONTENDURL,// Only allow your frontend URL
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.set("trust proxy", true);

app.use(cors(corsOptions));
// Add APIs, must be after middleware

import UserRouter from './routes/products.routes.js'
import uploadRouter from './routes/upload.routes.js'
import categoryRouter from './routes/category.routes.js'
import customersRoutes from './routes/customers.routes.js'
import orderRoutes from './routes/order.routes.js'
import testimonialsRoutes from './routes/testimonials.routes.js'
import productratingRoutes from './routes/productsrating.routes.js'
import resendEmailRoutes from './routes/resendemail.js'
import inventoryRouter from './routes/inventory.routes.js'
import analyticsRoutes from './routes/analytics.routes.js'
import getAllTimeMetricsRoutes from './routes/salesmetrics.routes.js'
import productPerformanceRouter from './routes/productperformance.routes.js'
// import shipRocketRoutes from './routes/shipRocket.routes.js'
import discountRouter from './routes/discount.routes.js'
import wishlistRoutes from './routes/wishlist.routes.js'
import { prisma } from './utils/prismaclient.js';
import { orderProcessed } from './utils/whatsappclient.js';
app.use(globalErrorHandler);
app.use("/api/products", UserRouter);
// app.use(Paths.Base, BaseRouter);

app.use("/api/upload", uploadRouter);

app.use("/api/category", categoryRouter);

app.use("/api/customers", customersRoutes);

app.use("/api/orders", orderRoutes);

app.use("/api/reviews", productratingRoutes);

app.use("/api/testimonials", testimonialsRoutes);


app.use("/api/send", resendEmailRoutes);

app.use("/api/inventory", inventoryRouter);

app.use("/api/analytics", analyticsRoutes);

app.use("/api/sales", getAllTimeMetricsRoutes);

app.use("/api/productperformance", productPerformanceRouter);

// app.use("/api/shiprocket", authenticateJWT, shipRocketRoutes);

app.use("/api/discounts", authenticateJWT, discountRouter);

app.use("/api/wishlists", wishlistRoutes);


// Add error handler

// app.use(authenticateJWT)



// **** FrontEnd Content **** //

// Set views directory (html)

// Redirect to login if not logged in.


/******************************************************************************
                                Export default
******************************************************************************/

// const seedSampleOrders = async () => {
//   try {
//     // 1. Create a sample user (or find existing)
//     const user = await prisma.user.upsert({
//       where: { mobile_no: "9999999999" },
//       update: {},
//       create: {
//         mobile_no: "9999999999",
//         name: "Sample User",
//         isPhoneNoVerified: true,
//         createdAt: new Date(),
//         updatedAt: new Date(),
//       },
//     })

//     // 2. Create a sample category
//     const category = await prisma.category.upsert({
//       where: { id: "sneakers-category" },  // Changed to use id instead of name
//       update: {},
//       create: {
//         id: "sneakers-category",  // Added id field
//         name: "Sneakers",
//         description: "Sample sneakers category",
//       },
//     })

//     // 3. Create 2 products with variants
//     const product1 = await prisma.product.create({
//       data: {
//         name: "Air Max 2025",
//         sku: "AMX-2025",
//         slug: "air-max-2025",
//         description: "Lightweight comfort shoes",
//         price: 12000,
//         category: { connect: { id: category.id } },
//         status: "PUBLISHED",
//       },
//     })

//     const color = await prisma.productColor.create({
//       data: {
//         color: "Black",
//         productId: product1.id,
//       },
//     })

//     const variant = await prisma.productVariant.create({
//       data: {
//         size: "SIZE_42",
//         stock: 10,
//         colorId: color.id,
//       },
//     })

//     // 4. Create sample address
//     const address = await prisma.address.create({
//       data: {
//         name: "Sample Address",
//         phone: "9999999999",
//         street: "123 Sample Street",
//         city: "Sample City",
//         state: "State",
//         country: "Country",
//         zipCode: "123456",
//         userId: user.id,
//       },
//     })

//     // 5. Create 3 sample orders with items
//     const sampleOrders = await Promise.all(
//       [1, 2, 3].map((i) =>
//         prisma.order.create({
//           data: {
//             userId: user.id,
//             total: 1200 * i,
//             status: "COMPLETED",
//             fulfillment: "DELIVERED",
//             addressId: address.id,
//             createdAt: new Date(),
//             items: {
//               create: [
//                 {
//                   productId: product1.id,
//                   productVariantId: variant.id,
//                   quantity: i,
//                   priceAtOrder: 12000,
//                   color: "Black",
//                   productImage: "https://via.placeholder.com/150",
//                   productName: "Air Max 2025",
//                   size: "SIZE_42",
//                 },
//               ],
//             },
//           },
//         })
//       )
//     )

//     //6. Create sample orders pending and shipped
//     await prisma.order.create({
//       data: {
//         userId: user.id,
//         total: 1200,
//         status: "PENDING",
//         fulfillment: "PENDING",
//         addressId: address.id,
//         createdAt: new Date(),
//         items: {
//           create: [
//             {
//               productId: product1.id,
//               productVariantId: variant.id,
//               quantity: 1,
//               priceAtOrder: 12000,
//               color: "Black",
//               productImage: "https://via.placeholder.com/150",
//               productName: "Air Max 2025",
//               size: "SIZE_42",
//             },
//           ],
//         },
//       },
//     })

//     await prisma.order.create({
//       data: {
//         userId: user.id,
//         total: 1200,
//         status: "COMPLETED",
//         fulfillment: "DELIVERED",
//         addressId: address.id,
//         createdAt: new Date(),
//         items: {
//           create: [
//             {
//               productId: product1.id,
//               productVariantId: variant.id,
//               quantity: 1,
//               priceAtOrder: 12000,
//               color: "Black",
//               productImage: "https://via.placeholder.com/150",
//               productName: "Air Max 2025",
//               size: "SIZE_42",
//             },
//           ],
//         },
//       },
//     })

//     // 7. Create sample orders with items
//     await prisma.order.create({
//       data: {
//         userId: user.id,
//         total: 1200,
//         status: "COMPLETED",
//         fulfillment: "DELIVERED",
//         addressId: address.id,
//         createdAt: new Date(),
//         items: {
//           create: [
//             {
//               productId: product1.id,
//               productVariantId: variant.id,
//               quantity: 1,
//               priceAtOrder: 12000,
//               color: "Black",
//               productImage: "https://via.placeholder.com/150",
//               productName: "Air Max 2025",
//               size: "SIZE_42",
//             },
//           ],
//         },
//       },
//     })


//   } catch (err) {
//     console.error("Error seeding orders:", err)
//   }
// }

// seedSampleOrders()
  // const seedCreateOldOrders = async () => {
  //   try {
  //     // pick old user id 
  //     const user = await prisma.user.findFirst({
  //       where: { mobile_no: "9999999999" },
  //     })

  //     if (!user) throw new Error("User not found")

  //     // pick old category id
  //     const category = await prisma.category.findFirst({
  //       where: { name: "Sneakers" },
  //     })

  //     // pick old product id
  //     const product = await prisma.product.findFirst({
  //       where: { name: "Air Max 2025" },
  //     })

  //     if (!product) throw new Error("Product not found")

  //     // pick old color id
  //     const color = await prisma.productColor.findFirst({
  //       where: { color: "Black" },
  //     })

  //     // pick old variant id
  //     const variant = await prisma.productVariant.findFirst({
  //       where: { size: "SIZE_42" },
  //     })

  //     if (!variant) throw new Error("Variant not found")

  //     // pick old address id
  //     const address = await prisma.address.findFirst({
  //       where: { name: "Sample Address" },
  //     })

  //     if (!address) throw new Error("Address not found")

  //     // create old orders
  //     await prisma.order.create({
  //       data: {
  //         userId: user.id,
  //         total: 1200,
  //         status: "COMPLETED",
  //         fulfillment: "DELIVERED",
  //         addressId: address.id,
  //         // one year old date
  //         createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  //         items: {
  //           create: [
  //             {
  //               productId: product.id,
  //               productVariantId: variant.id,
  //               quantity: 1,
  //               priceAtOrder: 12000,
  //               color: "Black",
  //               productImage: "https://via.placeholder.com/150",
  //               productName: "Air Max 2025",
  //               size: "SIZE_42",
  //             },
  //           ],
  //         },
  //       },
  //     })

  //     // create random orders
  //     for (let i = 0; i < 10; i++) {
  //       await prisma.order.create({
  //         data: {
  //           userId: user.id,
  //           total: 1200,
  //           // random status
  //           status: Math.random() > 0.5 ? "COMPLETED" : "PENDING",
  //           fulfillment: Math.random() > 0.5 ? "DELIVERED" : "PENDING",
  //           addressId: address.id,
  //           // random date
  //           createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
  //           items: {
  //             create: [
  //               {
  //                 productId: product.id,
  //                 productVariantId: variant.id,
  //                 quantity: 1,
  //                 priceAtOrder: 12000,
  //                 color: "Black",
  //                 productImage: "https://via.placeholder.com/150",
  //                 productName: "Air Max 2025",
  //                 size: "SIZE_42",
  //               },
  //             ],
  //           },
  //         },
  //       })
  //     }
  //   } catch (err) {
  //     console.error("Error seeding orders:", err)
  //   }
  // }

export default app;


