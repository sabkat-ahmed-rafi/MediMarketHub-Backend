const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express')
const cors = require('cors')
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require('dotenv').config()


const port = process.env.PORT 
const app = express()
app.use(cookieParser());


app.use(express.json())

app.use(cors({
  origin: ["http://localhost:5173"],
  credentials: true,
  optionSuccessStatus: 200,
}))


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
  }
});

async function run() {
  try {
    const database = client.db("MediMarketHub");
    const userCollection = database.collection("user");
    const medicineCollection = database.collection('medicine')


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
        app.get("/medicine", verifyToken, async (req, res) => {
          const result = await medicineCollection.find().toArray();
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
          const query = { email: user?.email };
          const options = { upsert: true };
          const updateDoc = {
            $set: {
              role: user?.role,
            },
          };
            const result = await userCollection.updateOne(query, updateDoc, options)
            res.send(result)
        })

        // Save medicine information on the database by inserting method
        app.post('/medicine', async (req, res) => {
          const medicine = req.body;
          const result = await medicineCollection.insertOne(medicine);
          res.send(result);
        }) 

    



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send("Welcome to MediMarketHub's server!")
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})