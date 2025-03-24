import fs from "fs/promises";
import { parseString } from "xml2js";
import path from "path";
import { fileURLToPath } from "url";
import { Product, Category } from "../models/index.js";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.join(__dirname, "../../client/public");

function promisifyParseString(xml) {
  return new Promise((resolve, reject) => {
    parseString(xml, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function getProductImages(productId, folderName) {
  try {
    const imagesDir = path.join(BASE_DIR, folderName, "import_files");
    const files = await fs.readdir(imagesDir);
    return files
      .filter((file) => file.startsWith(productId))
      .map((file) => `/${folderName}/import_files/${file}`);
  } catch (error) {
    console.error(`Error reading images for product ${productId}:`, error);
    return [];
  }
}

async function parseCatalog(catalogXml, folderName) {
  try {
    console.log(`Starting catalog parsing for folder ${folderName}...`);
    const catalogData = await promisifyParseString(catalogXml);
    console.log("Catalog XML parsed successfully");

    // Не очищаем категории здесь, так как это делается в основной функции
    const categories = new Map();

    function processGroup(group, parentId = null) {
      if (!group?.Ид?.[0] || !group?.Наименование?.[0]) {
        console.log("Skipping invalid group:", group);
        return;
      }

      const categoryId = group.Ид[0];
      const categoryName = group.Наименование[0];

      console.log(`Processing category: ${categoryName} (${categoryId})`);

      // Создаем категорию с пустыми массивами
      categories.set(categoryId, {
        id: categoryId,
        name: categoryName,
        parentId: parentId,
        children: [],
        products: [],
        folder: folderName, // Добавляем информацию о папке
      });

      // Добавляем в children родительской категории
      if (parentId && categories.has(parentId)) {
        const parentCategory = categories.get(parentId);
        if (!parentCategory.children.includes(categoryId)) {
          parentCategory.children.push(categoryId);
        }
      }

      // Обрабатываем дочерние группы
      if (group.Группы?.[0]?.Группа) {
        const childGroups = Array.isArray(group.Группы[0].Группа)
          ? group.Группы[0].Группа
          : [group.Группы[0].Группа];

        console.log(
          `Found ${childGroups.length} child groups for ${categoryName}`
        );
        childGroups.forEach((childGroup) => {
          processGroup(childGroup, categoryId);
        });
      }
    }

    const classifier = catalogData?.КоммерческаяИнформация?.Классификатор?.[0];
    console.log("Classifier found:", !!classifier);

    if (classifier?.Группы?.[0]?.Группа) {
      const rootGroups = Array.isArray(classifier.Группы[0].Группа)
        ? classifier.Группы[0].Группа
        : [classifier.Группы[0].Группа];

      console.log(`Found ${rootGroups.length} root groups`);
      rootGroups.forEach((group) => {
        processGroup(group);
      });
    } else {
      console.log("No root groups found in classifier");
    }

    // Сохраняем категории в базу данных
    const categoriesArray = Array.from(categories.values());
    console.log(
      `Categories to save for folder ${folderName}:`,
      JSON.stringify(categoriesArray, null, 2)
    );

    try {
      const savedCategories = await Category.insertMany(categoriesArray);
      console.log(
        `Saved ${savedCategories.length} categories to database for folder ${folderName}`
      );

      return categoriesArray;
    } catch (saveError) {
      console.error("Error saving categories:", saveError);
      console.error("First category that failed:", categoriesArray[0]);
      throw saveError;
    }
  } catch (error) {
    console.error("Error parsing catalog:", error);
    console.error("Error stack:", error.stack);
    throw error;
  }
}

async function updateCategoriesWithProducts(session) {
  try {
    console.log("Начало обновления категорий товарами...");

    // Получаем все товары и категории
    const [products, categories] = await Promise.all([
      Product.find({}, null, { session }),
      Category.find({}, null, { session }),
    ]);

    console.log(
      `Найдено товаров: ${products.length}, категорий: ${categories.length}`
    );

    // Создаем карту товаров по категориям
    const productsByCategory = new Map();
    products.forEach((product) => {
      if (product.category) {
        if (!productsByCategory.has(product.category)) {
          productsByCategory.set(product.category, []);
        }
        productsByCategory.get(product.category).push(product._id);
      }
    });

    // Формируем операции обновления
    const bulkOps = categories.map((category) => ({
      updateOne: {
        filter: { id: category.id },
        update: {
          $set: {
            products: productsByCategory.get(category.id) || [],
          },
        },
      },
    }));

    // Выполняем массовое обновление
    if (bulkOps.length > 0) {
      const result = await Category.bulkWrite(bulkOps, {
        session,
        ordered: false,
      });

      console.log(`
        Обновлено категорий: ${result.modifiedCount}
        Добавлено категорий: ${result.upsertedCount}
        Всего операций: ${bulkOps.length}
      `);
    }

    // Проверяем результат
    const updatedCategories = await Category.find({
      products: { $exists: true, $ne: [] },
    }).count();

    console.log(`Категорий с товарами после обновления: ${updatedCategories}`);
    console.log("Обновление категорий завершено успешно");
  } catch (error) {
    console.error("Ошибка при обновлении категорий:", error);
    throw error;
  }
}

// Функция для поиска папок с XML файлами
async function findXmlFolders() {
  try {
    const items = await fs.readdir(BASE_DIR);
    const xmlFolders = [];

    // Ищем файл каталога в корневой папке
    const catalogFile = items.find(
      (file) => file.includes("import___") && !file.includes("catalogs")
    );
    console.log("Найден файл каталога в корне:", catalogFile);

    for (const item of items) {
      const fullPath = path.join(BASE_DIR, item);
      const stats = await fs.stat(fullPath);

      if (stats.isDirectory()) {
        console.log(`\nПроверка папки ${item}:`);

        // Проверяем наличие XML файлов в папке
        const files = await fs.readdir(fullPath);
        console.log("Все файлы в папке:", files);

        const hasXmlFiles = files.some((file) => file.endsWith(".xml"));
        console.log("Есть XML файлы:", hasXmlFiles);

        if (hasXmlFiles) {
          const importFiles = files.filter((f) => f.includes("import___"));
          const priceFiles = files.filter((f) => f.includes("prices___"));
          const restFiles = files.filter((f) => f.includes("rests___"));

          console.log("Найденные файлы:", {
            import: importFiles,
            prices: priceFiles,
            rests: restFiles,
            catalog: catalogFile ? [catalogFile] : [],
          });

          xmlFolders.push({
            name: item,
            path: fullPath,
            importFiles,
            priceFiles,
            restFiles,
            catalogFiles: catalogFile ? [catalogFile] : [],
          });
        }
      }
    }

    console.log(
      "\nИтоговый список папок с XML файлами:",
      xmlFolders.map((f) => ({
        name: f.name,
        files: {
          import: f.importFiles.length,
          prices: f.priceFiles.length,
          rests: f.restFiles.length,
          catalog: f.catalogFiles.length,
        },
      }))
    );
    return xmlFolders;
  } catch (error) {
    console.error("Ошибка при поиске папок:", error);
    throw error;
  }
}

// Функция для обработки одной папки
async function processXmlFolder(folder) {
  console.log(`\nОбработка папки ${folder.name}...`);

  try {
    // Проверяем наличие всех необходимых файлов
    console.log("Проверка файлов в папке:", {
      import: folder.importFiles,
      prices: folder.priceFiles,
      rests: folder.restFiles,
      catalog: folder.catalogFiles,
    });

    // Проверяем наличие файла импорта
    if (!folder.importFiles.length) {
      console.log(`Пропускаем папку ${folder.name} - отсутствует файл импорта`);
      return null;
    }

    // Читаем файлы
    console.log(`Чтение файла импорта: ${folder.importFiles[0]}`);
    const importXml = await fs.readFile(
      path.join(folder.path, folder.importFiles[0]),
      "utf-8"
    );
    const importData = await promisifyParseString(importXml);
    console.log("Import XML parsed successfully");

    // Читаем файл каталога из корневой папки, если он есть
    let categories = [];
    if (folder.catalogFiles.length > 0) {
      console.log(
        `Чтение файла каталога из корневой папки: ${folder.catalogFiles[0]}`
      );
      const catalogXml = await fs.readFile(
        path.join(BASE_DIR, folder.catalogFiles[0]),
        "utf-8"
      );
      categories = await parseCatalog(catalogXml, folder.name);
    } else {
      console.log(
        "Файл каталога не найден в корневой папке, пропускаем обработку категорий"
      );
    }

    // Читаем файл цен, если он есть
    let pricesData = null;
    if (folder.priceFiles.length > 0) {
      console.log(`Чтение файла цен: ${folder.priceFiles[0]}`);
      const pricesXml = await fs.readFile(
        path.join(folder.path, folder.priceFiles[0]),
        "utf-8"
      );
      pricesData = await promisifyParseString(pricesXml);
      console.log("Prices XML parsed successfully");
    } else {
      console.log("Файл цен не найден, пропускаем обработку цен");
    }

    // Читаем файл остатков, если он есть
    let restsData = null;
    if (folder.restFiles.length > 0) {
      console.log(`Чтение файла остатков: ${folder.restFiles[0]}`);
      const restsXml = await fs.readFile(
        path.join(folder.path, folder.restFiles[0]),
        "utf-8"
      );
      restsData = await promisifyParseString(restsXml);
      console.log("Rests XML parsed successfully");
    } else {
      console.log("Файл остатков не найден, пропускаем обработку остатков");
    }

    // Обрабатываем товары
    const товары =
      importData?.КоммерческаяИнформация?.Каталог?.[0]?.Товары?.[0]?.Товар ||
      [];
    console.log(`Found ${товары.length} products in import XML`);

    // Выводим структуру первого товара для отладки
    if (товары.length > 0) {
      console.log(
        "Sample product structure:",
        JSON.stringify(товары[0], null, 2)
      );
    }

    const productsToSave = [];

    for (const item of товары) {
      const productId = item?.Ид?.[0];
      const categoryId = item?.Группы?.[0]?.Ид?.[0];
      const name = item?.Наименование?.[0];
      const article = item?.Артикул?.[0];

      if (!productId || !categoryId || !name || !article) {
        console.log(`Skipping product due to missing required fields:`, {
          productId,
          categoryId,
          name,
          article,
        });
        continue;
      }

      const images = await getProductImages(productId, folder.name);
      console.log(`Found ${images.length} images for product ${productId}`);

      const product = {
        id: productId,
        name: name,
        article: article,
        description: item?.Описание?.[0] || "",
        category: categoryId,
        price: 0,
        quantity: 0,
        images: images,
        folder: folder.name,
      };

      productsToSave.push(product);
    }

    // Сохраняем товары
    if (productsToSave.length > 0) {
      console.log(`Attempting to save ${productsToSave.length} products...`);
      const savedProducts = await Product.insertMany(productsToSave, {
        ordered: false,
      });
      console.log(
        `Saved ${savedProducts.length} products from folder ${folder.name}`
      );

      // Обновляем цены
      if (
        pricesData &&
        pricesData.КоммерческаяИнформация.ПакетПредложений?.[0]
          ?.Предложения?.[0]?.Предложение
      ) {
        const предложения =
          pricesData.КоммерческаяИнформация.ПакетПредложений[0].Предложения[0]
            .Предложение;
        console.log(`Found ${предложения.length} price offers`);

        for (const offer of предложения) {
          if (
            offer?.Ид?.[0] &&
            offer?.Цены?.[0]?.Цена?.[0]?.ЦенаЗаЕдиницу?.[0]
          ) {
            const productId = offer.Ид[0];
            const price = parseFloat(offer.Цены[0].Цена[0].ЦенаЗаЕдиницу[0]);

            const updateResult = await Product.findOneAndUpdate(
              { id: productId, folder: folder.name },
              { $set: { price: price } }
            );
            if (updateResult) {
              console.log(`Updated price for product ${productId}: ${price}`);
            }
          }
        }
      }

      // Обновляем остатки
      if (
        restsData &&
        restsData.КоммерческаяИнформация.ПакетПредложений?.[0]?.Предложения?.[0]
          ?.Предложение
      ) {
        const остатки =
          restsData.КоммерческаяИнформация.ПакетПредложений[0].Предложения[0]
            .Предложение;
        console.log(`Found ${остатки.length} rest records`);

        for (const rest of остатки) {
          if (
            rest?.Ид?.[0] &&
            rest?.Остатки?.[0]?.Остаток?.[0]?.Склад?.[0]?.Количество?.[0]
          ) {
            const productId = rest.Ид[0];
            const quantity =
              parseInt(rest.Остатки[0].Остаток[0].Склад[0].Количество[0]) || 0;

            const updateResult = await Product.findOneAndUpdate(
              { id: productId, folder: folder.name },
              { $set: { quantity: quantity } }
            );
            if (updateResult) {
              console.log(
                `Updated quantity for product ${productId}: ${quantity}`
              );
            }
          }
        }
      }
    }

    return {
      products: productsToSave,
      categories,
    };
  } catch (error) {
    console.error(`Error processing folder ${folder.name}:`, error);
    throw error;
  }
}

// Основная функция импорта
export async function parseXMLFiles() {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("Starting XML parsing...");

    // Очищаем базу данных
    await Category.deleteMany({});
    await Product.deleteMany({});
    console.log("Database cleared");

    // Находим все папки с XML файлами
    const xmlFolders = await findXmlFolders();

    // Обрабатываем каждую папку
    const results = [];
    for (const folder of xmlFolders) {
      const result = await processXmlFolder(folder);
      results.push(result);
    }

    // Обновляем связи категорий с товарами
    await updateCategoriesWithProducts(session);

    await session.commitTransaction();
    console.log("Транзакция успешно завершена");

    return {
      results,
      totalProducts: await Product.countDocuments(),
      totalCategories: await Category.countDocuments(),
    };
  } catch (error) {
    await session.abortTransaction();
    console.error("Error parsing XML files:", error);
    throw error;
  }
}
