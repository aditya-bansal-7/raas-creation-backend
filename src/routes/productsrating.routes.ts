import { Router } from "express";
import productreviewController from "../controllers/productrating.controller.js";
import { authenticateJWT } from "../middleware/globalerrorhandler.js";

const router = Router();


// 📦 Create testimonial

router.post("/:productId",authenticateJWT, productreviewController.createreview);

// 📦 Get all testimonial by product id
router.get("/:productId", productreviewController.getReviewsByProductId);


export default router;

