-- AlterTable
ALTER TABLE "Payouts" ALTER COLUMN "amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Submission" ALTER COLUMN "amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Worker" ALTER COLUMN "locked_amount" SET DATA TYPE BIGINT;
