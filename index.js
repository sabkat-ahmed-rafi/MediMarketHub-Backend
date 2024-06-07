require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT;
const app = express();
app.use(cookieParser());

app.use(express.json());

app.use(
  cors({
    origin: ["https://zesty-florentine-44a022.netlify.app"],
    credentials: true,
    optionSuccessStatus: 200,
  })
);

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_KEY}@medimarkethub.ioocywf.mongodb.net/?retryWrites=true&w=majority&appName=MediMarketHub`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const database = client.db("MediMarketHub");
    const userCollection = database.collection("user");
    const medicineCollection = database.collection("medicine");
    const categoryCollection = database.collection("category");
    const cartCollection = database.collection("cart");
    const advertisementCollection = database.collection("advertisement");
    const sliderCollection = database.collection("slider");
    const purchaseCollection = database.collection("purchase");

    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // Get all user from database.
    app.get("/users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Get a user from the database.
    app.get("/user/:email", verifyToken, async (req, res) => {
      const user = req.user;
      const query = { email: user?.email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // Get all the medicine information
    app.get("/medicine", async (req, res) => {
      let search = req.query.search;
      const sort = req.query.sort;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 3;
      const skip = (page - 1) * limit;
      if (typeof search !== "string") {
        search = "";
      }
      const query = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { genericName: { $regex: search, $options: "i" } },
          { company: { $regex: search, $options: "i" } },
          { category: { $regex: search, $options: "i" } },
        ],
      };
      const sortQuery = { sort: { price: sort == "ascending" ? 1 : -1 } };
      const result = await medicineCollection
        .find(query, sortQuery)
        .skip(skip)
        .limit(limit)
        .toArray();
      res.send(result);
    });

    // Get discounted medicine from database 
    app.get("/discountMedicine", async (req, res) => {
      const result = await medicineCollection
       .find({ percentage: { $gt: 0 } })
       .toArray();
      res.send(result);
    });

    // Get totalCount of medicine
    app.get("/medicine/count", async (req, res) => {
      const result = await medicineCollection.countDocuments();
      res.send({ result });
    });

    // Get all medicine of a seller
    app.get("/medicine/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { seller: email };
      const result = await medicineCollection.find(query).toArray();
      res.send(result);
    });

    // Get all category information
    app.get("/category", async (req, res) => {
      const result = await categoryCollection.find().toArray();
      res.send(result);
    });

    // Get a Specific category from database
    app.get("/category/:category", async (req, res) => {
      const category = req.params.category;
      const query = { category: category };
      const result = await medicineCollection.find(query).toArray();
      res.send(result);
    });

    // Get all advertisement data from database
    app.get("/advertisement", verifyToken, async (req, res) => {
      const result = await advertisementCollection.find().toArray();
      res.send(result);
    });

    // Get all advertised slider
    app.get("/slider", async (req, res) => {
      const result = await sliderCollection.find().toArray();
      res.send(result);
    });

    // Get all cart product from database
    app.get("/cart/:email", verifyToken, async (req, res) => {
      const user = req.user;
      const query = { buyerEmail: user?.email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    // Get all purchase data from database 
    app.get("/purchase", verifyToken, async (req, res) => {
      const result = await purchaseCollection.find().toArray();
      res.send(result);
    });

    // Get a specific purchase item
    app.get("/purchase/:transactionId", verifyToken, async (req, res) => {
      const id = req.params.transactionId;
      const query = { transactionId: id };
      const result = await purchaseCollection.findOne(query);
      res.send(result);
    });

    // Get all payment history by user
    app.get("/purchase/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { buyerEmail: email };
      const result = await purchaseCollection.find(query).toArray();
      res.send(result);
    });

    // Get all payment historyo by seller
    app.get("/purchase/seller/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { sellerEmail: email };
      const result = await purchaseCollection.find(query).toArray();
      res.send(result);
    });

    // Get Total Amounts of Payments of seller
    app.get("/seller-total-statistics/:email", async (req, res) => {
      const email = req.params.email;

      const pipeline1 = [
        { $match: { status: "pending", sellerEmail: email } },
        { $group: { _id: null, totalAmount: { $sum: "$totalAmount" } } },
      ];

      const pipeline2 = [
        { $match: { status: "paid", sellerEmail: email } },
        { $group: { _id: null, totalAmount: { $sum: "$totalAmount" } } },
      ];

      const pipeline3 = [
        { $match: { sellerEmail: email } },
        { $group: { _id: null, totalAmount: { $sum: "$totalAmount" } } },
      ];

      const pipeline1Result = await purchaseCollection
        .aggregate(pipeline1)
        .toArray();
      const pipeline2Result = await purchaseCollection
        .aggregate(pipeline2)
        .toArray();
      const pipeline3Result = await purchaseCollection
        .aggregate(pipeline3)
        .toArray();

      const pendingAmount =
        pipeline1Result.length > 0 ? pipeline1Result[0].totalAmount : 0;
      const paidAmount =
        pipeline2Result.length > 0 ? pipeline2Result[0].totalAmount : 0;
      const totalAmount =
        pipeline3Result.length > 0 ? pipeline3Result[0].totalAmount : 0;

      res.send({ totalAmount, paidAmount, pendingAmount });
    });

    // Get Total Amounts of payments
    app.get("/admin-total-statistics", async (req, res) => {
      const pipeline1 = [
        { $match: { status: "pending" } },
        { $group: { _id: null, totalAmount: { $sum: "$totalAmount" } } },
      ];

      const pipeline2 = [
        { $match: { status: "paid" } },
        { $group: { _id: null, totalAmount: { $sum: "$totalAmount" } } },
      ];

      const pipeline3 = [
        { $group: { _id: null, totalAmount: { $sum: "$totalAmount" } } },
      ];

      const pipeline1Result = await purchaseCollection
        .aggregate(pipeline1)
        .toArray();
      const pipeline2Result = await purchaseCollection
        .aggregate(pipeline2)
        .toArray();
      const pipeline3Result = await purchaseCollection
        .aggregate(pipeline3)
        .toArray();

      const pendingAmount =
        pipeline1Result.length > 0 ? pipeline1Result[0].totalAmount : 0;
      const paidAmount =
        pipeline2Result.length > 0 ? pipeline2Result[0].totalAmount : 0;
      const totalAmount =
        pipeline3Result.length > 0 ? pipeline3Result[0].totalAmount : 0;

      res.send({ totalAmount, paidAmount, pendingAmount });
    });

    // Update a category information
    app.put("/category", verifyToken, async (req, res) => {
      const category = req.body;
      const query = { name: category?.name };
      const updateDoc = { $set: { ...category } };
      const result = await categoryCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Delete a category from database
    app.delete("/category/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await categoryCollection.deleteOne(query);
      res.send(result);
    });

    // Save a user in the database at the time of login.
    app.put("/user", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };

      const isExist = await userCollection.findOne(query);
      if (isExist) {
        return res.send(isExist);
      }

      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      };
      const result = await userCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // Update a user role
    app.patch("/user/updateRole", verifyToken, async (req, res) => {
      const user = req.body;
      const query = { email: user?.userEmail };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          role: user?.role,
        },
      };
      const result = await userCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // Save medicine information on the database by inserting method
    app.post("/medicine", async (req, res) => {
      const medicine = req.body;
      const query = { name: medicine.name };
      const isExist = await medicineCollection.findOne(query);
      if (isExist)
        return res.status(400).send({ message: "Medicine already exist" });
      const result = await medicineCollection.insertOne(medicine);
      res.send(result);
    });

    // Save category information in the database
    app.post("/category", async (req, res) => {
      const category = req.body;
      const query = { category: category.categoryName };
      const medicine = await medicineCollection.find(query).toArray();
      const categoryInfo = { ...category, totalIncategory: medicine.length };
      const result = await categoryCollection.insertOne(categoryInfo);
      res.send(result);
    });

    // Save single data in the cart on database
    app.post("/cart", async (req, res) => {
      const cart = req.body;
      const query = { name: cart.name, buyerEmail: cart.buyerEmail };
      const isExist = await cartCollection.findOne(query);

      if (isExist)
        return res.status(400).send({ message: "Medicine already exist" });

      const result = await cartCollection.insertOne(cart);
      res.send(result);
    });

    // Save Advertisement data on the database
    app.post("/advertisement", async (req, res) => {
      const advertisement = req.body;
      const query = { name: advertisement.name };
      const isExist = await advertisementCollection.findOne(query);
      if (isExist)
        return res.status(400).send({ message: "Advertisement already exist" });
      const result = await advertisementCollection.insertOne(advertisement);
      res.send(result);
    });

    // Save advertisement data for slider ads
    app.post("/slider", async (req, res) => {
      const slider = req.body;
      const query = { name: slider.name };
      const isExist = await sliderCollection.findOne(query);
      if (isExist) {
        const changeAdvertisement = await advertisementCollection.updateOne(
          query,
          { $set: { isAdvertised: "No" } }
        );
        const changeMedicine = await medicineCollection.updateOne(query, {
          $set: { isAdvertised: "No" },
        });
        const removeSlider = await sliderCollection.deleteOne(query);
        return res.send(removeSlider);
      }
      const changeAdvertisement = await advertisementCollection.updateOne(
        query,
        { $set: { isAdvertised: "Yes" } }
      );
      const changeMedicine = await medicineCollection.updateOne(query, {
        $set: { isAdvertised: "Yes" },
      });
      const result = await sliderCollection.insertOne(slider);
      res.send(result);
    });

    // Change the Quantity of a product from database
    app.patch("/cart/quantity-increase", verifyToken, async (req, res) => {
      const medicine = req.body;
      const query = { name: medicine?.name };
      const findPrice = await medicineCollection.findOne(query);
      const updateDoc = {
        $inc: {
          quantity: 1,
          price: findPrice?.price,
        },
      };
      const result = await cartCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Change the Quantity of a product from database
    app.patch("/cart/quantity-decrease", verifyToken, async (req, res) => {
      const medicine = req.body;
      const query = { name: medicine?.name };
      const findPrice = await medicineCollection.findOne(query);
      const findPriceCart = await cartCollection.findOne(query);
      if (findPriceCart?.price == findPrice.price) {
        return res
          .status(400)
          .send({ message: "price cannot be less that its original value" });
      }
      const updateDoc = {
        $inc: {
          quantity: -1,
          price: -findPrice?.price,
        },
      };
      const result = await cartCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Clear the Cart by deleting user specific data
    app.delete("/cartClear/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { buyerEmail: email };
      const result = await cartCollection.deleteMany(query);
      res.send(result);
    });

    // Delete an item from cart
    app.delete("/cart/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Creating a client secret for payment in stripe
    app.post("/create-payment-intent", async (req, res) => {
      const price = req.body.amount;
      const priceInCent = parseFloat(price) * 100;

      if (!price || priceInCent < 1) return;

      // Create a PaymentIntent with the order amount and currency
      const { client_secret } = await stripe.paymentIntents.create({
        amount: priceInCent,
        currency: "usd",

        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.send({ clientSecret: client_secret });
    });

    // Save purchase info the database
    app.post("/purchase", verifyToken, async (req, res) => {
      const purchase = req.body;
      const query = { buyerEmail: purchase.buyerEmail };
      const result1 = await purchaseCollection.insertOne(purchase);
      const result = await cartCollection.deleteMany(query);
      res.send(result1);
    });

    // Changing payment status 
    app.patch('/acceptPayment/:transactionId', async (req, res) => {
      const id = req.params.transactionId;
      const status = req.body.status;
      const query = { transactionId: id };
      const updateDoc = {
        $set: {
          status: status,
        },
      };
      const result = await purchaseCollection.updateOne(query, updateDoc);
      res.send(result);
    })



    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Welcome to MediMarketHub's server!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
