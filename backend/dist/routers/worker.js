"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
const privateKey_1 = require("../privateKey");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const bs58_1 = __importDefault(require("bs58"));
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const middleware_1 = require("../middleware");
const config_1 = require("../config");
const web3_js_1 = require("@solana/web3.js");
const connection = new web3_js_1.Connection((_a = process.env.RPC_URL) !== null && _a !== void 0 ? _a : "");
const db_1 = require("../db");
const prismaClient = new client_1.PrismaClient();
const TOTAL_SUBMISSIONS = 100;
const types_1 = require("../types");
prismaClient.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
}), {
    maxWait: 5000,
    timeout: 10000,
});
router.post("/payout", middleware_1.workerMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    const userId = req.userId;
    const worker = yield prismaClient.worker.findFirst({
        where: { id: Number(userId) }
    });
    if (!worker) {
        return res.status(403).json({
            message: "User not found"
        });
    }
    const transaction = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
        fromPubkey: new web3_js_1.PublicKey("2KeovpYvrgpziaDsq8nbNMP4mc48VNBVXb5arbqrg9Cq"),
        toPubkey: new web3_js_1.PublicKey(worker.address),
        lamports: worker.pending_amount,
    }));
    console.log(worker.address);
    const decodedPrivateKey = bs58_1.default.decode(privateKey_1.privateKey);
    const keypair = web3_js_1.Keypair.fromSecretKey(decodedPrivateKey);
    // const decodedPrivateKey = bs58.decode(privateKey);
    // const keypair = Keypair.fromSecretKey(decode(privateKey));
    // TODO: There's a double spending problem here
    // The user can request the withdrawal multiple times
    // Can u figure out a way to fix it?
    let signature = "";
    try {
        signature = yield (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [keypair]);
    }
    catch (e) {
        return res.json({
            message: "Transaction failed"
        });
    }
    console.log(signature);
    // We should add a lock here
    yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        yield tx.worker.update({
            where: {
                id: Number(userId)
            },
            data: {
                pending_amount: {
                    decrement: worker.pending_amount
                },
                locked_amount: {
                    increment: worker.pending_amount
                }
            }
        });
        yield tx.payouts.create({
            data: {
                user_id: Number(userId),
                amount: worker.pending_amount,
                status: "Processing",
                signature: signature
            }
        });
    }));
    res.json({
        message: "Processing payout",
        amount: worker.pending_amount
    });
    // const userId: string = req.userId;
    // const worker = await prismaClient.worker.findFirst({
    //     where: { id: Number(userId) }
    // })
    // if (!worker) {
    //     return res.status(403).json({
    //         message: "User not found"
    //     })
    // }
    // const pendingAmount = BigInt(worker.pending_amount);
    // if (pendingAmount > BigInt(2147483647) || pendingAmount < BigInt(-2147483648)) {
    //         return res.status(400).json({
    //             message: "Pending amount exceeds the range of a 32-bit signed integer"
    //         });
    //     }
    // // We should add a lock here
    // const txnId = "0x12312312";
    // await prismaClient.$transaction(async tx => {
    //     await tx.worker.update({
    //         where: {
    //             id: Number(userId)
    //         },
    //         data: {
    //             pending_amount: {
    //                 decrement: Number(pendingAmount)
    //             },
    //             locked_amount: {
    //                 increment: Number(pendingAmount)
    //             }
    //         }
    //     })
    //     await tx.payouts.create({
    //         data: {
    //             user_id: Number(userId),
    //             amount: Number(pendingAmount),
    //             status: "Processing",
    //             signature: txnId
    //         }
    //     })
    // })
    // res.json({
    //     message: "Processing payout",
    //     amount: pendingAmount.toString()
    // })
}));
router.get("/balance", middleware_1.workerMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    const userId = req.userId;
    const worker = yield prismaClient.worker.findFirst({
        where: {
            id: Number(userId)
        }
    });
    res.json({
        pendingAmount: worker === null || worker === void 0 ? void 0 : worker.pending_amount,
        lockedAmount: worker === null || worker === void 0 ? void 0 : worker.pending_amount,
    });
}));
router.post("/submission", middleware_1.workerMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    const userId = req.userId;
    console.log("Request Body:", req.body); // Log the request body
    const parsedBody = types_1.createSubmissionInput.safeParse(req.body);
    if (parsedBody.success) {
        const task = yield (0, db_1.getNextTask)(Number(userId));
        if (!task || task.id !== Number(parsedBody.data.taskId)) {
            return res.status(411).json({
                message: "Incorrect task id"
            });
        }
        const amount = (Number(task.amount) / TOTAL_SUBMISSIONS).toString();
        try {
            const submission = yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                const submission = yield tx.submission.create({
                    data: {
                        option_id: Number(parsedBody.data.selection),
                        worker_id: userId,
                        task_id: Number(parsedBody.data.taskId),
                        amount: Number(amount)
                    }
                });
                yield tx.worker.update({
                    where: {
                        id: userId,
                    },
                    data: {
                        pending_amount: {
                            increment: Number(amount)
                        }
                    }
                });
                return submission;
            }));
            const nextTask = yield (0, db_1.getNextTask)(Number(userId));
            return res.json({
                nextTask,
                amount
            });
        }
        catch (error) {
            console.error("Transaction error:", error);
            return res.status(500).json({
                message: "Error processing the submission"
            });
        }
    }
    else {
        console.error("Validation Errors:", parsedBody.error);
        res.status(411).json({
            message: "Incorrect inputs"
        });
    }
}));
router.get("/nextTask", middleware_1.workerMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    const userId = req.userId;
    const task = yield (0, db_1.getNextTask)(Number(userId));
    // const task = await prismaClient.task.findFirst({
    //     where: {
    //         done: false,
    //         submissions: {
    //             none: {
    //                 worker_id: userId,
    //             }
    //         }
    //     },
    //     select: {
    //         title:true,
    //         options: true
    //     }
    // });
    if (!task) {
        res.status(411).json({
            message: "No more tasks left to review"
        });
    }
    else {
        res.status(200).json({
            task
        });
    }
}));
console.log("hello");
router.post("/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Signin route hit");
    console.log(config_1.WORKER_JWT_SECRET);
    const { publicKey, signature } = req.body;
    console.log(req.body);
    const message = new TextEncoder().encode("Sign into mechanical turks as worker");
    // console.log(req.body)
    console.log(publicKey);
    console.log(signature);
    const signatureArray = new Uint8Array(signature.data);
    const result = tweetnacl_1.default.sign.detached.verify(message, signatureArray, new web3_js_1.PublicKey(publicKey).toBytes());
    if (!result) {
        return res.status(411).json({
            message: "Incorrect signature"
        });
    }
    try {
        // const hardCodedWalletAddress = "BiZTieP1UW53dYL75gtRLuUJ5A1djGDqbnKFTBmEPHSb";
        const existingUser = yield prismaClient.worker.findFirst({
            where: {
                address: publicKey
            }
        });
        let token;
        if (existingUser) {
            token = jsonwebtoken_1.default.sign({ userId: existingUser.id }, config_1.WORKER_JWT_SECRET);
            res.json({
                token,
                amount: existingUser.pending_amount
            });
        }
        else {
            const user = yield prismaClient.worker.create({
                data: {
                    address: publicKey,
                    pending_amount: 0,
                    locked_amount: 0
                }
            });
            token = jsonwebtoken_1.default.sign({ userId: user.id }, config_1.WORKER_JWT_SECRET);
        }
        console.log(token);
        res.status(200).json({ token });
    }
    catch (error) {
        console.error("Error during sign-in:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}));
console.log("hello");
exports.default = router;
