import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import cors from "cors";
import { parseXMLFiles } from "./utils/xmlParse.js";
import { Product } from "./models/index.js";
import dotenv from "dotenv";
import { Category } from "./models/index.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Маршруты

app.get("/api/categories", async (req, res) => {
  try {
    const categories = await Category.find({});

    // Преобразуем плоский список в дерево
    const categoryMap = new Map();
    const rootCategories = [];

    // Сначала создаем мап всех категорий
    categories.forEach((category) => {
      categoryMap.set(category.id, {
        ...category.toObject(),
        children: [],
      });
    });

    // Затем строим дерево
    categories.forEach((category) => {
      const categoryObj = categoryMap.get(category.id);
      if (category.parentId) {
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          parent.children.push(categoryObj);
        }
      } else {
        rootCategories.push(categoryObj);
      }
    });

    console.log(
      "Сформированное дерево категорий:",
      JSON.stringify(rootCategories, null, 2)
    );
    res.json(rootCategories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Ошибка при получении категорий" });
  }
});
// Маршрут для импорта товаров
app.post("/import-products", async (req, res) => {
  try {
    await Product.deleteMany({});
    const products = await parseXMLFiles();
    // Очищаем коллекцию перед импортом
    /* await Product.insertMany(products); */
    res.json({
      message: "Products imported successfully",
      count: products.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Маршрут для получения всех товаров
app.get("/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Импорт XML
app.post("/api/import", async (req, res) => {
  try {
    const result = await parseXMLFiles();
    res.json(result);
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ error: "Ошибка при импорте данных" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
