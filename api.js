const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const colors = require("colors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const cloudinary = require("cloudinary").v2;
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const connectDB = require("./config/db.js");
require("dotenv").config();
const productModel = require("./models/productModel.js");

// Database connection
connectDB();

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

const app = express();

// Middlewares
app.use(cors());
app.use(helmet());
app.use(mongoSanitize());
app.use(morgan("dev"));
app.use(express.json());
app.use(bodyParser.json());
app.use(cookieParser());

// Routes
const testRoutes = require("./routes/testRoutes.js");
const userRoutes = require("./routes/userRoutes.js");
const productRoutes = require("./routes/productRoutes.js");
const categoryRoutes = require("./routes/categoryRoutes.js");
const orderRoutes = require("./routes/orderRoutes.js");

app.use("/api/v1", testRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/product", productRoutes);
app.use("/api/v1/cat", categoryRoutes);
app.use("/api/v1/order", orderRoutes);

app.get("/api", (req, res) => {
  res.json({ message: "Hello from the API! we are getting started" });
});

app.post("/api/v1/payments", async (req, res) => {
  try {
    const {
      amount,
      currency,
      customerDetails,
      shippingAddress,
      billingDetails,
    } = req.body;

    // Create a new customer in Stripe with both billing and shipping details
    const customer = await stripe.customers.create({
      name: customerDetails.name,
      email: customerDetails.email,
      phone: customerDetails.phone,
      shipping: {
        name: shippingAddress.name,
        address: {
          line1: shippingAddress.line1,
          line2: shippingAddress.line2,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.postal_code,
          country: shippingAddress.country,
        },
      },
      address: {
        line1: billingDetails.line1,
        line2: billingDetails.line2,
        city: billingDetails.city,
        state: billingDetails.state,
        postal_code: billingDetails.postal_code,
        country: billingDetails.country,
      },
    });

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: "2022-11-15" }
    );

    // Create a payment intent associated with the customer
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customer.id,
      payment_method_types: ["card"], // Specify payment methods you want to support
    });

    res.json({ paymentIntent: paymentIntent.client_secret });

    // Respond with the client secret of the payment intent
    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
      publishableKey:
        "pk_test_51MVgSgKix8j5hIGdHEEVTRTqLeNIKccM1NAypsCpyMkz8y7bkCHCGzmysGkQ3uv6ewR3qiBjEVfWISAsTBRVa5p200QpH2AEe2",
    });
  } catch (error) {
    console.error("Payment Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/v1/payment", async (req, res) => {
  const { amount, currency, customerDetails, shippingAddress, billingDetails } =
    req.body;
  try {
    // Create a new customer in Stripe with both billing and shipping details
    const customer = await stripe.customers.create({
      name: customerDetails.name,
      email: customerDetails.email,
      phone: customerDetails.phone,
      shipping: {
        name: shippingAddress.name,
        address: {
          line1: shippingAddress.line1,
          line2: shippingAddress.line2,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.postal_code,
          country: shippingAddress.country,
        },
      },
      address: {
        line1: billingDetails.line1,
        line2: billingDetails.line2,
        city: billingDetails.city,
        state: billingDetails.state,
        postal_code: billingDetails.postal_code,
        country: billingDetails.country,
      },
    });
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: "2024-06-20" } // Specify the desired API version
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd",
      customer: customer.id,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
    });
  } catch (e) {
    res.status(400).json({
      error: e.message,
    });
  }
});

app.get("/api/v1/search", async (req, res) => {
  const { query } = req.query;

  try {
    // Find products where the name matches the search query (case-insensitive)
    const products = await productModel.find({
      name: { $regex: query, $options: "i" }, // 'i' for case-insensitive
    });

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`.green);
});