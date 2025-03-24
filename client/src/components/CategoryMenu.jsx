import React, { useState, useEffect } from "react";
import {
  Box,
  List,
  ListItem,
  ListItemText,
  Collapse,
  IconButton,
} from "@mui/material";
import { IoIosArrowDown, IoIosArrowUp } from "react-icons/io";

const CategoryItem = ({ category, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = category.children && category.children.length > 0;

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <>
      <ListItem
        button
        onClick={handleClick}
        sx={{
          pl: 2 * (level + 1),
          "&:hover": {
            bgcolor: "action.hover",
          },
        }}
      >
        <ListItemText
          primary={category.name}
          primaryTypographyProps={{
            style: {
              fontWeight: isOpen ? "bold" : "normal",
            },
          }}
        />
        {hasChildren && (
          <IconButton edge="end" size="small">
            {isOpen ? <IoIosArrowUp /> : <IoIosArrowDown />}
          </IconButton>
        )}
      </ListItem>

      {hasChildren && (
        <Collapse in={isOpen} timeout="auto" unmountOnExit>
          <List disablePadding>
            {category.children.map((child) => (
              <CategoryItem key={child.id} category={child} level={level + 1} />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
};

const CategoryMenu = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("http://localhost:3000/api/categories");
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        console.log("Полученные категории:", data); // Для отладки
        setCategories(data);
      } catch (error) {
        console.error("Ошибка загрузки категорий:", error);
        setError("Не удалось загрузить категории");
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  if (loading) return <Box sx={{ p: 2 }}>Загрузка...</Box>;
  if (error) return <Box sx={{ p: 2, color: "error.main" }}>{error}</Box>;

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 360,
        bgcolor: "background.paper",
        borderRadius: 1,
        boxShadow: 1,
      }}
    >
      <List>
        {categories.map((category) => (
          <CategoryItem key={category.id} category={category} />
        ))}
      </List>
    </Box>
  );
};

export default CategoryMenu;
