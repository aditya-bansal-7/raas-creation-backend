import { AssetType, VariantsValues } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import HttpStatusCodes from "../common/httpstatuscode.js";
import { RouteError, ValidationErr } from "../common/routeerror.js";
import {
  addProductSchema,
  updateStockSchema,
  addColorSchema,
  addSizesSchema,
  updateColorSchema,
} from "../types/validations/product.js";

import { prisma } from "../utils/prismaclient.js";

const cleanSlug = (text: string): string => {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove non-word characters
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+|-+$/g, ""); // Trim - from start/end
};

const slugify = async (text: string): Promise<string> => {
  let baseSlug = cleanSlug(text);
  let uniqueSlug = baseSlug;
  let count = 0;

  while (await prisma.product.findFirst({ where: { slug: uniqueSlug } })) {
    const randomSuffix = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .substring(2, 5)}`;
    uniqueSlug = `${baseSlug}-${randomSuffix}`;
    count++;
    if (count > 5) break; // fail-safe to prevent infinite loop
  }

  return uniqueSlug;
};

/** ✅ Add a new product */
const addProduct = async (req: Request, res: Response, next: NextFunction) => {
  const parsed = addProductSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationErr(parsed.error.errors);
  }
  const {
    name,
    description,
    price,
    discountPrice,
    category_id,
    assets,
    status,
    sku,
    tags,
  } = parsed.data;

  const slug = await slugify(name);

  const product = await prisma.product.create({
    data: {
      name,
      description,
      price,
      discountPrice: discountPrice || null,
      category_id,
      status,
      sku,
      slug,
      assets: {
        create:
          assets?.map((asset: { url: string; type: AssetType }) => ({
            asset_url: asset.url,
            type: asset.type,
          })) || [],
      },
      tags: {
        create: tags?.map((tag: string) => ({ tag })),
      },
    },
    include: { assets: true, tags: true },
  });

  res.status(HttpStatusCodes.CREATED).json({ success: true, product });
};

/** ✅ Add a color to an existing product */
const addColor = async (req: Request, res: Response, next: NextFunction) => {
  const parsed = addColorSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationErr(parsed.error.errors);
  }
  const { productId, color, assets, sizes, colorHex } = parsed.data;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Product not found");
  }

  const productColor = await prisma.productColor.create({
    data: {
      color,
      colorHex,
      productId,
      assets: {
        create:
          assets?.map((asset: { url: string; type: AssetType }) => ({
            asset_url: asset.url,
            type: asset.type,
          })) || [],
      },
      sizes: {
        create:
          sizes?.map((asset: { size: VariantsValues; stock: number }) => ({
            size: asset.size,
            stock: asset.stock,
          })) || [],
      },
    },
    include: { assets: true },
  });

  res.status(HttpStatusCodes.CREATED).json({ success: true, productColor });
};

/** ✅ Add sizes & stock to a color */
const addSizes = async (req: Request, res: Response, next: NextFunction) => {
  const parsed = addSizesSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationErr(parsed.error.errors);
  }
  const { colorId, sizes } = parsed.data;

  const color = await prisma.productColor.findUnique({
    where: { id: colorId },
  });
  if (!color) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Color not found");
  }

  const variants = await prisma.productVariant.createMany({
    data: sizes.map((sizeObj) => ({
      size: sizeObj.size,
      stock: sizeObj.stock,
      colorId,
    })),
  });

  res.status(HttpStatusCodes.CREATED).json({ success: true, variants });
};

/** ✅ Update a color */
const updateColor = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const parsed = updateColorSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationErr(parsed.error.errors);
  }
  const { name, assets, colorHex } = parsed.data;

  // First, delete all existing assets and sizes for this color
  const productColor = await prisma.$transaction([
    prisma.productAsset.deleteMany({
      where: { colorId: id },
    }),
    prisma.productColor.update({
      where: { id },
      data: {
        color: name,
        colorHex,
        assets: {
          create:
            assets?.map((asset: { url: string; type: AssetType }) => ({
              asset_url: asset.url,
              type: asset.type,
            })) || [],
        },
      },
      include: { assets: true },
    }),
  ]);

  // Then update the color with new assets and sizes

  res.status(HttpStatusCodes.OK).json({ success: true, productColor });
};

/** ✅ Update stock for a specific size */
const updateStock = async (req: Request, res: Response, next: NextFunction) => {
  const parsed = updateStockSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationErr(parsed.error.errors);
  }
  const { variantId, stock } = parsed.data;

  const updatedVariant = await prisma.productVariant.update({
    where: { id: variantId },
    data: { stock },
  });

  res.status(HttpStatusCodes.OK).json({ success: true, updatedVariant });
};

/** ✅ Delete an asset */
const deleteAsset = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!id) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing asset id");
  }

  const asset = await prisma.productAsset.findUnique({ where: { id } });
  if (!asset) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Asset not found");
  }

  await prisma.productAsset.delete({ where: { id } });
  res
    .status(HttpStatusCodes.OK)
    .json({ success: true, message: "Asset deleted" });
};

/** ✅ Get a product with colors and variants */
const getProduct = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!id) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing product id");
  }

  let product = await prisma.product.findUnique({
    where: { id },
    include: {
      assets: true,
      tags: true,
      colors: {
        include: {
          assets: true,
          sizes: true,
        },
      },
    },
  });

  product = {
    ...product,
    // @ts-ignore
    tags: product.tags.map((tag) => tag.tag),
  };

  if (!product) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Product not found");
  }
  res.status(HttpStatusCodes.OK).json({ success: true, product });
};
const getSlugProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { slug } = req.params;
  if (!slug) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing product id");
  }

  let product = await prisma.product.findFirst({
    where: { slug },
    include: {
      assets: true,
      tags: true,
      colors: {
        include: {
          assets: true,
          sizes: true,
        },
      },
    },
  });

  product = {
    ...product,
    // @ts-ignore
    tags: product.tags.map((tag) => tag.tag),
  };

  if (!product) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Product not found");
  }
  res.status(HttpStatusCodes.OK).json({ success: true, product });
};

/** ✅ Get all products */
const getAllProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string) || undefined;
  const status = req.query.status as "PUBLISHED" | "DRAFT" | undefined;
  const minPrice = parseFloat(req.query.min_price as string) || undefined;
  const maxPrice = parseFloat(req.query.max_price as string) || undefined;
  const color = (req.query.color as string) || undefined;
  const size = (req.query.size as string) || undefined;
  const categoryQuery = (req.query.category as string) || undefined;
  const categories = categoryQuery ? categoryQuery.split(",") : [];
  const sizes = size ? size.split(",") : [];
  const skip = (page - 1) * limit;
  const sortBy = (req.query.sortBy as string) || "createdAt";
  const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";
  
  const priceFilter = {
    ...(minPrice && { gte: minPrice }),
    ...(maxPrice && { lte: maxPrice }),
  };

  const whereClause: any = {
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(status && { status: status }),
    ...(Object.keys(priceFilter).length > 0 && { discountPrice: priceFilter }),
    ...(categories.length > 0 && {
      category_id: {
        in: categories,
      },
    }),
    ...(color && {
      colors: {
        some: {
          color: {
            equals: color,
            mode: "insensitive",
          },
        },
      },
    }),
    ...(sizes.length > 0 && {
      colors: {
        some: {
          sizes: {
            some: {
              AND: [
                {
                  size: {
                    in: sizes as any,
                  },
                },
                {
                  stock: {
                    gt: 0,
                  },
                },
              ],
            },
          },
        },
      },
    }),
  };

  const totalCount = await prisma.product.count({ where: whereClause });

  const products = await prisma.product.findMany({
    where: whereClause,
    include: {
      assets: true,
      tags: true,
    },
    orderBy: {
      [sortBy]: sortOrder,
    },
    skip,
    take: limit,
  });

  const totalPages = Math.ceil(totalCount / limit);

  res.status(200).json({
    success: true,
    products: products,
    pagination: {
      totalPages,
      currentPage: page,
      totalItems: totalCount,
      itemsPerPage: limit,
    },
  });
};

const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;

  if (!id) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing product id");
  }

  const parsed = addProductSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationErr(parsed.error.errors);
  }

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Product not found");
  }

  const {
    name,
    description,
    price,
    discountPrice,
    category_id,
    assets,
    status,
    tags,
    sku
  } = parsed.data;

  // First, delete existing assets if new ones are provided
  if (assets && assets.length > 0) {
    await prisma.productAsset.deleteMany({
      where: {
        productId: id,
        colorId: null,
      },
    });
  }

  // update product tags
  await prisma.productTags.deleteMany({
    where: {
      productId: id,
    },
  });
  if (tags && tags.length > 0) {
    await prisma.productTags.createMany({
      data: tags.map((tag) => ({
        tag,
        productId: id,
      })),
    });
  }

  let slug = product.slug;

  if ( name !== product.name) {
    slug = await slugify(name);
  }

  // Update the product with all fields
  const updatedProduct = await prisma.product.update({
    where: { id },
    data: {
      name,
      description,
      price,
      discountPrice,
      category_id,
      status,
      sku,
      slug,
      assets: assets
        ? {
            create: assets.map((asset: { url: string; type: AssetType }) => ({
              asset_url: asset.url,
              type: asset.type,
            })),
          }
        : undefined,
    },
    include: {
      assets: true,
    },
  });

  res.status(HttpStatusCodes.OK).json({ success: true, updatedProduct });
};
const updateStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!id) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing product id");
  }
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Product not found");
  }
  await prisma.product.update({
    where: { id },
    data: { status },
  });
  res
    .status(HttpStatusCodes.OK)
    .json({ success: true, message: "Product status updated" });
};

const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  if (!id) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing product id");
  }

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Product not found");
  }

  await prisma.product.delete({ where: { id } });
  res
    .status(HttpStatusCodes.OK)
    .json({ success: true, message: "Product deleted" });
};

/** ✅ Delete a product color */
const deleteColor = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!id) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing color id");
  }

  const color = await prisma.productColor.findUnique({ where: { id } });
  if (!color) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Color not found");
  }

  await prisma.productColor.delete({ where: { id } });
  res
    .status(HttpStatusCodes.OK)
    .json({ success: true, message: "Product color deleted" });
};

/** ✅ Delete a product variant (size) */
const deleteVariant = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  if (!id) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing variant id");
  }

  const variant = await prisma.productVariant.findUnique({ where: { id } });
  if (!variant) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Variant not found");
  }

  await prisma.productVariant.delete({ where: { id } });
  res
    .status(HttpStatusCodes.OK)
    .json({ success: true, message: "Product variant deleted" });
};

const getOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const [totalProducts, totalRevenue, lastMonthRevenue, totalUsers,pendingRevenue] =
      await Promise.all([
        prisma.product.count({ where: { status: "PUBLISHED" } }),
        prisma.order.aggregate({
          _sum: { total: true },
          where: { paid: true },
        }),
        prisma.order.aggregate({
          _sum: { total: true },
          where: {
            createdAt: { gte: oneMonthAgo },
            paid: true,
          },
        }),
        prisma.user.count(),
        prisma.order.aggregate({
          _sum: { total: true },
          where: {
            paid: false,
          },
        })
      ]);

    const totalRevenueValue = totalRevenue._sum.total || 0;
    const lastMonthRevenueValue = lastMonthRevenue._sum.total || 0;

    let growthPercentage = "0%";
    if (totalRevenueValue > 0) {
      growthPercentage =
        ((lastMonthRevenueValue / totalRevenueValue) * 100).toFixed(1) + "%";
    }

    res.status(200).json({
      totalProducts,
      revenue: totalRevenueValue,
      growth: growthPercentage,
      usersCount: totalUsers,
      pendingRevenue: pendingRevenue._sum.total || 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching product overview" });
  }
};

const getColors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const colors = await prisma.productColor.findMany({
      distinct: ["color"],
      orderBy: {
        color: 'asc'
      }
    });
    res.status(200).json(colors);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching product colors" });
  }
};

export default {
  addProduct,
  addColor,
  addSizes,
  updateStock,
  updateColor,
  deleteAsset,
  getProduct,
  getAllProduct,
  updateProduct,
  updateStatus,
  deleteProduct,
  deleteColor,
  deleteVariant,
  getOverview,
  getSlugProduct,
  getColors,
};
