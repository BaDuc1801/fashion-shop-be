import mongoose from "mongoose"
import cors from 'cors'
import express from "express"
import dotenv from "dotenv"
import cookieParser from "cookie-parser"

dotenv.config()

await mongoose.connect(process.env.MONGOCONNECT)

const corsOptions = {
    origin: ['https://fashion-shop-tau-three.vercel.app','https://fashion-shop-admin-topaz.vercel.app', 'http://localhost:4000','http://localhost:4001'],  
    methods: ['GET', 'POST', 'PUT', 'DELETE'],  
    credentials: true, 
};

const app = express();
app.use(express.json());
app.use(cors(corsOptions));
app.use(cookieParser());


app.get("/", (req, res) => {
    res.status(200).json({ message: "hello!" });
});

app.listen(8080, () => {
    console.log("Server is running")
})