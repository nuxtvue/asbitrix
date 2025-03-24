import { useState, useEffect } from "react";
import axios from "axios";

function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchProducts = async () => {
    try {
      const response = await axios.get("http://localhost:3000/products");
      if (response.status === 200) setProducts(response.data);

      console.log(response.data);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      await axios.post("http://localhost:3000/import-products");
      await fetchProducts();
    } catch (error) {
      console.error("Error importing products:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return (
    <div>
      <button onClick={handleImport} disabled={loading}>
        {loading ? "Импортирование..." : "Импортировать товары"}
      </button>

      <div className="products-grid">
        {products.map((product) => (
          <div key={product.id} className="product-card">
            <h3>{product.name}</h3>
            <p>Артикул: {product.article}</p>
            <p>Цена: {product.price} ₽</p>
            <p>В наличии: {product.quantity} шт.</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProductList;
