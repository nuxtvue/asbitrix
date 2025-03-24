import express from "express";
import { Category } from "../models/index.js";

const router = express.Router();

// Получение всех категорий
router.get("/", async (req, res) => {
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

export default router;
