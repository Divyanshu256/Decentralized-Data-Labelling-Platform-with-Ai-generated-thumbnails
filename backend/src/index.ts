import express from "express";
import workerRouter from "./routers/worker";
import cors from "cors";
import userRouter from "./routers/user";
// export const JWT_SECRET="div@123"
const app=express();
app.use(express.json())
app.use(cors());
app.use("/v1/user",userRouter);
app.use('/v1/worker', workerRouter);
app.listen(3000)