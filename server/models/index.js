import mongoose from "mongoose";

// Схема продукта
const productSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true, // Добавляем индекс
  },
  name: {
    type: String,
    required: true,
  },
  article: String,
  price: {
    type: Number,
    default: 0,
  },
  quantity: {
    type: Number,
    default: 0,
  },
  description: String,
  category: {
    type: String,
    index: true, // Добавляем индекс
  },
  folder: {
    type: String,
    required: true,
    index: true,
  },
  images: [String],
  lastUpdate: {
    type: Date,
    default: Date.now,
  },
});

// Схема категории
const categorySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    parentId: {
      type: String,
      ref: "Category",
      default: null,
    },
    children: [
      {
        type: String,
        ref: "Category",
      },
    ],
    products: [
      {
        type: String,
        ref: "Product",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Создаем индексы
productSchema.index({ lastUpdate: 1 }, { expireAfterSeconds: null });

categorySchema.index({ id: 1 });
categorySchema.index({ parentId: 1 });

// Инициализируем модели
const models = {};

if (!mongoose.models.Product) {
  models.Product = mongoose.model("Product", productSchema);
} else {
  models.Product = mongoose.models.Product;
}

if (!mongoose.models.Category) {
  models.Category = mongoose.model("Category", categorySchema);
} else {
  models.Category = mongoose.models.Category;
}

export const { Product, Category } = models;
