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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const client_1 = require("@prisma/client");
const client_s3_1 = require("@aws-sdk/client-s3");
const middleware_1 = require("../middleware");
const s3_presigned_post_1 = require("@aws-sdk/s3-presigned-post");
const web3_js_1 = require("@solana/web3.js");
const config_1 = require("../config");
const connection = new web3_js_1.Connection((_a = process.env.RPC_URL) !== null && _a !== void 0 ? _a : "");
const PARENT_WALLET_ADDRESS = "BiZTieP1UW53dYL75gtRLuUJ5A1djGDqbnKFTBmEPHSb";
// BiZTieP1UW53dYL75gtRLuUJ5A1djGDqbnKFTBmEPHSb
const types_1 = require("../types");
const prismaClient = new client_1.PrismaClient();
const router = (0, express_1.Router)();
prismaClient.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
}), {
    maxWait: 5000,
    timeout: 10000,
});
const DEFAULT_TITLE = "Select the most clickable thumbnail";
const s3Client = new client_s3_1.S3Client({
    credentials: {
        accessKeyId: "AKIA2UC267ZFSWGCETXE",
        secretAccessKey: "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"
    },
    region: "us-east-1"
});
router.get("/task", middleware_1.authMiddleware, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    // Access query parameters correctly
    const taskId = req.query.taskId; // Ensure taskId is of type string
    // @ts-ignore
    const userId = req.userId; // Assuming userId is set by your authMiddleware
    if (!taskId) {
        return res.status(400).json({ message: "Task ID is required" }); // Handle missing taskId
    }
    // Fetch the task details from the database
    const taskDetails = yield prismaClient.task.findFirst({
        where: {
            user_id: userId, // Use userId directly, it's assumed to be a number
            id: Number(taskId) // Convert taskId to a number
        },
        include: {
            options: true
        }
    });
    // Check if taskDetails was found
    if (!taskDetails) {
        return res.status(403).json({
            message: "You don't have access to this task"
        });
    }
    // Check if taskDetails has options
    if (!taskDetails.options || taskDetails.options.length === 0) {
        return res.status(404).json({
            message: "No options found for this task"
        });
    }
    // Fetch responses related to the task
    const responses = yield prismaClient.submission.findMany({
        where: {
            task_id: taskDetails.id // Use taskDetails.id
        },
        include: {
            option: true
        }
    });
    // Initialize the result object
    const result = {};
    // Populate the result based on task details options
    taskDetails.options.forEach(option => {
        result[option.id] = {
            count: 0,
            option: {
                imageUrl: option.image_url
            }
        };
    });
    // Count the submissions for each option
    responses.forEach(r => {
        if (result[r.option_id]) {
            result[r.option_id].count++; // Increment count only if the option exists
        }
    });
    // Send the response
    res.json({
        result,
        taskDetails
    });
}));
router.post("/task", middleware_1.authMiddleware, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const body = req.body;
    // @ts-ignore
    const userId = req.userId;
    const parseData = types_1.createTaskInput.safeParse(body);
    const user = yield prismaClient.user.findFirst({
        where: {
            id: userId
        }
    });
    if (!parseData.success) {
        console.log(parseData.error);
        res.status(411).json({
            message: "You've sent wrong inputs",
            errors: parseData.error.errors
        });
        return;
    }
    const transaction = yield connection.getTransaction(parseData.data.signature, {
        maxSupportedTransactionVersion: 1
    });
    console.log(transaction);
    if (((_b = (_a = transaction === null || transaction === void 0 ? void 0 : transaction.meta) === null || _a === void 0 ? void 0 : _a.postBalances[1]) !== null && _b !== void 0 ? _b : 0) - ((_d = (_c = transaction === null || transaction === void 0 ? void 0 : transaction.meta) === null || _c === void 0 ? void 0 : _c.preBalances[1]) !== null && _d !== void 0 ? _d : 0) !== 100000000) {
        return res.status(411).json({
            message: "Transaction signature/amount incorrect"
        });
    }
    if (((_e = transaction === null || transaction === void 0 ? void 0 : transaction.transaction.message.getAccountKeys().get(1)) === null || _e === void 0 ? void 0 : _e.toString()) !== PARENT_WALLET_ADDRESS) {
        return res.status(411).json({
            message: "Transaction sent to wrong address"
        });
    }
    if (((_f = transaction === null || transaction === void 0 ? void 0 : transaction.transaction.message.getAccountKeys().get(0)) === null || _f === void 0 ? void 0 : _f.toString()) !== (user === null || user === void 0 ? void 0 : user.address)) {
        return res.status(411).json({
            message: "Transaction sent to wrong address"
        });
    }
    // was this money paid by this user address or a different address?
    // parse the signature here to ensure the person has paid 0.1 SOL
    // const transaction = Transaction.from(parseData.data.signature);
    try {
        const response = yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const task = yield tx.task.create({
                data: {
                    title: (_a = parseData.data.title) !== null && _a !== void 0 ? _a : DEFAULT_TITLE,
                    amount: 0.1 * config_1.TOTAL_DECIMALS,
                    signature: parseData.data.signature,
                    user_id: userId
                }
            });
            yield tx.option.createMany({
                data: parseData.data.options.map((x) => ({
                    image_url: x.imageUrl,
                    task_id: task.id
                }))
            });
            return task;
        }));
        res.json({
            id: response.id
        });
    }
    catch (error) {
        next(error); // Pass the error to the error-handling middleware
    }
}));
router.get("/presignedUrl", middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    const userId = req.userId;
    const { url, fields } = yield (0, s3_presigned_post_1.createPresignedPost)(s3Client, {
        Bucket: 'decentimage',
        Key: `fiver/${userId}/${Math.random()}/image.jpg`,
        Conditions: [
            ['content-length-range', 0, 5 * 1024 * 1024] // 5 MB max
        ],
        Expires: 3600
    });
    res.json({
        preSignedUrl: url,
        fields
    });
}));
router.post("/signin", middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { publicKey, signature } = req.body;
    const message = new TextEncoder().encode("Sign into mechanical turks");
    console.log(req.body);
    console.log(publicKey);
    const signatureArray = new Uint8Array(signature.data);
    const result = tweetnacl_1.default.sign.detached.verify(message, signatureArray, new web3_js_1.PublicKey(publicKey).toBytes());
    if (!result) {
        return res.status(411).json({
            message: "Incorrect signature"
        });
    }
    // const hardCodedWalltetAddress="BiZTieP1UW53dYL75gtRLuUJ5A1djGDqbnKFTBmEPHSb";
    const existingUser = yield prismaClient.user.findFirst({
        where: {
            address: publicKey
        }
    });
    if (existingUser) {
        const token = jsonwebtoken_1.default.sign({
            userId: existingUser.id
        }, config_1.JWT_SECRET);
        console.log(token);
        res.json({ token });
    }
    else {
        const user = yield prismaClient.user.create({
            data: {
                address: publicKey,
            }
        });
        const token = jsonwebtoken_1.default.sign({
            userId: user.id
        }, config_1.JWT_SECRET);
        console.log(token);
        res.json({ token });
    }
}));
exports.default = router;
