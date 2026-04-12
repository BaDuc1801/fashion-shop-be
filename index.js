import mongoose from "mongoose"
import cors from "cors"
import express from "express"
import dotenv from "dotenv"
import cookieParser from "cookie-parser"

dotenv.config()

const corsOptions = {
    origin: [
        "https://fashion-shop-tau-three.vercel.app",
        "https://fashion-shop-admin-topaz.vercel.app",
        "http://localhost:4000",
        "http://localhost:4001",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
}

const app = express()
app.use(express.json())
app.use(cors(corsOptions))
app.use(cookieParser())

async function connectDb() {
    const uri = process.env.MONGOCONNECT
    if (!uri) {
        throw new Error("Missing MONGOCONNECT")
    }
    if (mongoose.connection.readyState === 1) {
        return
    }
    await mongoose.connect(uri)
}

app.get("/", (req, res) => {
    res.status(200).json({ message: "hello!" })
})

const isVercel = Boolean(process.env.VERCEL)

if (!isVercel) {
    connectDb()
        .then(() => {
            app.listen(8080, () => {
                console.log("Server is running")
            })
        })
        .catch((err) => {
            console.error(err)
            process.exit(1)
        })
}

export default app
