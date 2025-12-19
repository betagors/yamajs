export { default as plugin } from "./plugin";
export { createS3Adapter, createS3Bucket } from "./adapter";
export { initS3Client, getS3Client, closeS3Client, type S3Config } from "./client";
export { S3StorageProvider, S3StorageAPI } from "./provider";
import "./provider"; // Register adapter

