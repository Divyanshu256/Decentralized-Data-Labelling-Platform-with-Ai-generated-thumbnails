import {Router} from "express";
import jwt from "jsonwebtoken";
import nacl from "tweetnacl";
import { PrismaClient } from '@prisma/client';
import { S3Client,GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { authMiddleware } from "../middleware";
import { Request, Response, NextFunction } from 'express';
import {createPresignedPost} from '@aws-sdk/s3-presigned-post'
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { JWT_SECRET, TOTAL_DECIMALS } from "../config";
const connection = new Connection(process.env.RPC_URL ?? "");
const PARENT_WALLET_ADDRESS = "BiZTieP1UW53dYL75gtRLuUJ5A1djGDqbnKFTBmEPHSb";
// BiZTieP1UW53dYL75gtRLuUJ5A1djGDqbnKFTBmEPHSb
import { createTaskInput } from "../types";
const prismaClient = new PrismaClient();
interface SigninRequestBody {
    publicKey: string;
    signature: {
        data: number[];
    };
}

const router =Router();
prismaClient.$transaction(
    async (prisma)=>{
        
    },{
        maxWait:5000,
        timeout:10000,
    }
)
const DEFAULT_TITLE="Select the most clickable thumbnail"

const s3Client=new S3Client({
    credentials:{
        accessKeyId:"AKIA2UC267ZFSWGCETXE",
        secretAccessKey:"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"
    },
    region: "us-east-1"
})
router.get("/task", authMiddleware, async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    // Access query parameters correctly
    const taskId: string | undefined = req.query.taskId as string; // Ensure taskId is of type string
    // @ts-ignore
    const userId: number = req.userId; // Assuming userId is set by your authMiddleware

    if (!taskId) {
        return res.status(400).json({ message: "Task ID is required" }); // Handle missing taskId
    }

    // Fetch the task details from the database
    const taskDetails = await prismaClient.task.findFirst({
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
    const responses = await prismaClient.submission.findMany({
        where: {
            task_id: taskDetails.id // Use taskDetails.id
        },
        include: {
            option: true
        }
    });

    // Initialize the result object
    const result: Record<string, {
        count: number;
        option: {
            imageUrl: string;
        };
    }> = {};

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
});


router.post("/task", authMiddleware, async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const body = req.body;
    // @ts-ignore
    const userId = req.userId;
    const parseData = createTaskInput.safeParse(body);
    const user = await prismaClient.user.findFirst({
        where: {
            id: userId
        }
    })
    if (!parseData.success) {
        console.log(parseData.error)
        res.status(411).json({
            message: "You've sent wrong inputs",
            errors: parseData.error.errors 
        });
        return;
    }
    const transaction = await connection.getTransaction(parseData.data.signature, {
        maxSupportedTransactionVersion: 1
    });

    console.log(transaction);

    if ((transaction?.meta?.postBalances[1] ?? 0) - (transaction?.meta?.preBalances[1] ?? 0) !== 100000000) {
        return res.status(411).json({
            message: "Transaction signature/amount incorrect"
        })
    }

    if (transaction?.transaction.message.getAccountKeys().get(1)?.toString() !== PARENT_WALLET_ADDRESS) {
        return res.status(411).json({
            message: "Transaction sent to wrong address"
        })
    }

    if (transaction?.transaction.message.getAccountKeys().get(0)?.toString() !== user?.address) {
        return res.status(411).json({
            message: "Transaction sent to wrong address"
        })
    }
    // was this money paid by this user address or a different address?

    // parse the signature here to ensure the person has paid 0.1 SOL
    // const transaction = Transaction.from(parseData.data.signature);



    try {
        const response = await prismaClient.$transaction(async (tx) => {
            const task = await tx.task.create({
                data: {
                    title: parseData.data.title ?? DEFAULT_TITLE,
                    amount: 0.1*TOTAL_DECIMALS,
                    signature: parseData.data.signature,
                    user_id: userId
                }
            });

            await tx.option.createMany({
                data: parseData.data.options.map((x: { imageUrl: string }) => ({
                    image_url: x.imageUrl,
                    task_id: task.id
                }))
            });

            return task;
        });

        res.json({
            id: response.id
        });
    } catch (error) {
        next(error); // Pass the error to the error-handling middleware
    }
});

router.get("/presignedUrl", authMiddleware,async (req,res)=> {
    // @ts-ignore
    const userId = req.userId;

    const { url, fields } = await createPresignedPost(s3Client, {
        Bucket: 'decentimage',
        Key: `fiver/${userId}/${Math.random()}/image.jpg`,
        Conditions: [
          ['content-length-range', 0, 5 * 1024 * 1024] // 5 MB max
        ],
        Expires: 3600
    })

    res.json({
        preSignedUrl: url,
        fields
    })

})

router.post("/signin",authMiddleware,async(req:Request<{}, {}, SigninRequestBody>,res):Promise<any>=>{
    const { publicKey, signature } = req.body;
    const message = new TextEncoder().encode("Sign into mechanical turks");
    console.log(req.body)
    console.log(publicKey)
    const signatureArray = new Uint8Array(signature.data);
    const result = nacl.sign.detached.verify(
        message,
        signatureArray,
        new PublicKey(publicKey).toBytes(),
    );


    if (!result) {
        return res.status(411).json({
            message: "Incorrect signature"
        })
    }


    // const hardCodedWalltetAddress="BiZTieP1UW53dYL75gtRLuUJ5A1djGDqbnKFTBmEPHSb";
    const existingUser=await prismaClient.user.findFirst({
        where:{
            address:publicKey
        }
    })
    if(existingUser){
    const token=jwt.sign({
        userId:existingUser.id
    },JWT_SECRET)
    console.log(token)
    res.json({token})
}
    else{
        const user= await prismaClient.user.create({
            data:{
                address:publicKey, 
            }
        })
        const token=jwt.sign({
            userId:user.id
        },JWT_SECRET)
        console.log(token)
        res.json({token})
    }

    
});

export default router;