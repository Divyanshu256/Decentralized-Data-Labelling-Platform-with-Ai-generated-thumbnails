import {Router} from "express";
const router =Router();
import { privateKey } from "../privateKey";
import { Jwt } from "jsonwebtoken";
import jwt from "jsonwebtoken";
import { PrismaClient } from '@prisma/client';
import bs58 from "bs58";
import decode from "bs58";
import nacl from "tweetnacl";
import { authMiddleware, workerMiddleware } from "../middleware";
import { Request, Response, NextFunction } from 'express';
import {createPresignedPost} from '@aws-sdk/s3-presigned-post'
import { JWT_SECRET, TOTAL_DECIMALS, WORKER_JWT_SECRET} from "../config";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
const connection = new Connection(process.env.RPC_URL ?? "");
import { createTaskInput } from "../types";
import { getNextTask } from "../db";
const prismaClient = new PrismaClient();
const TOTAL_SUBMISSIONS = 100;
import { createSubmissionInput } from "../types";
prismaClient.$transaction(
    async (prisma)=>{
        
    },{
        maxWait:5000,
        timeout:10000,
    }
)

router.post("/payout", workerMiddleware, async (req, res) : Promise<any> => {
    // @ts-ignore
    const userId: string = req.userId;
    const worker = await prismaClient.worker.findFirst({
        where: { id: Number(userId) }
    })

    if (!worker) {
        return res.status(403).json({
            message: "User not found"
        })
    }

    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: new PublicKey("2KeovpYvrgpziaDsq8nbNMP4mc48VNBVXb5arbqrg9Cq"),
            toPubkey: new PublicKey(worker.address),
            lamports: worker.pending_amount ,
        })
    );


    console.log(worker.address);
    const decodedPrivateKey = bs58.decode(privateKey);
    const keypair = Keypair.fromSecretKey(decodedPrivateKey);

    // const decodedPrivateKey = bs58.decode(privateKey);
    // const keypair = Keypair.fromSecretKey(decode(privateKey));

    // TODO: There's a double spending problem here
    // The user can request the withdrawal multiple times
    // Can u figure out a way to fix it?
    let signature = "";
    try {
        signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [keypair],
        );
    
     } catch(e) {
        return res.json({
            message: "Transaction failed"
        })
     }
    
    console.log(signature)

    // We should add a lock here
    await prismaClient.$transaction(async tx => {
        await tx.worker.update({
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
        })

        await tx.payouts.create({
            data: {
                user_id: Number(userId),
                amount: worker.pending_amount,
                status: "Processing",
                signature: signature
            }
        })
    })

    res.json({
        message: "Processing payout",
        amount: worker.pending_amount
    })

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
})


router.get("/balance", workerMiddleware, async (req, res) => {
    // @ts-ignore
    const userId: string = req.userId;

    const worker = await prismaClient.worker.findFirst({
        where: {
            id: Number(userId)
        }
    })

    res.json({
        pendingAmount: worker?.pending_amount,
        lockedAmount: worker?.pending_amount,
    })
})


router.post("/submission", workerMiddleware, async (req, res): Promise<any> => {
    // @ts-ignore
    const userId = req.userId;
    
    console.log("Request Body:", req.body); // Log the request body

    const parsedBody = createSubmissionInput.safeParse(req.body);

    if (parsedBody.success) {
        const task = await getNextTask(Number(userId));

        if (!task || task.id !== Number(parsedBody.data.taskId)) {
            return res.status(411).json({
                message: "Incorrect task id"
            });
        }

        const amount = (Number(task.amount) / TOTAL_SUBMISSIONS).toString();

        try {
            const submission = await prismaClient.$transaction(async (tx) => {
                const submission = await tx.submission.create({
                    data: {
                        option_id: Number(parsedBody.data.selection),
                        worker_id: userId,
                        task_id: Number(parsedBody.data.taskId),
                        amount: Number(amount)
                    }
                });

                await tx.worker.update({
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
            });

            const nextTask = await getNextTask(Number(userId));
            return res.json({
                nextTask,
                amount
            });
        } catch (error) {
            console.error("Transaction error:", error);
            return res.status(500).json({
                message: "Error processing the submission"
            });
        }
    } else {
        console.error("Validation Errors:", parsedBody.error);
         res.status(411).json({
            message: "Incorrect inputs"
        });
    }
});


router.get("/nextTask", workerMiddleware, async (req: Request, res: Response): Promise<void> => {
    // @ts-ignore
    const userId:string = req.userId;
    const task =await getNextTask(Number(userId));

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
    } else {
        res.status(200).json({
            task
        });
    }
});
console.log("hello")

router.post("/signin", async (req: Request, res: Response): Promise<any> => {
    console.log("Signin route hit");
    console.log(WORKER_JWT_SECRET)
    const { publicKey, signature } = req.body;
    console.log(req.body)
    const message = new TextEncoder().encode("Sign into mechanical turks as worker");
    // console.log(req.body)
    console.log(publicKey)
    console.log(signature)
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


    try {
        // const hardCodedWalletAddress = "BiZTieP1UW53dYL75gtRLuUJ5A1djGDqbnKFTBmEPHSb";
        const existingUser = await prismaClient.worker.findFirst({
            where: {
                address: publicKey
            }
        });

        let token;
        if (existingUser) {
            token = jwt.sign({ userId: existingUser.id }, WORKER_JWT_SECRET);
            res.json({
                token,
                amount:existingUser.pending_amount
            })
        } else {
            const user = await prismaClient.worker.create({
                data: {
                    address: publicKey,
                    pending_amount: 0,
                    locked_amount: 0
                }
            });
            token = jwt.sign({ userId: user.id }, WORKER_JWT_SECRET);
        }

        console.log(token);
        res.status(200).json({ token });
    } catch (error) {
        console.error("Error during sign-in:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});


console.log("hello")
export default router;