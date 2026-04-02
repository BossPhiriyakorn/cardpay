import { Schema, model, models, type InferSchemaType } from "mongoose";

const LineMessageLogSchema = new Schema(
  {
    audience: {
      type: String,
      enum: ["admin", "user"],
      required: true,
      index: true,
    },
    eventType: { type: String, required: true, trim: true, index: true },
    recipientType: {
      type: String,
      enum: ["cms_admin", "user", "manual"],
      required: true,
      index: true,
    },
    recipientId: { type: String, default: "", trim: true, index: true },
    lineUserId: { type: String, required: true, trim: true, index: true },
    success: { type: Boolean, required: true, index: true },
    messagePreview: { type: String, default: "", trim: true },
    errorMessage: { type: String, default: "", trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

export type LineMessageLogDocument = InferSchemaType<typeof LineMessageLogSchema>;

const LineMessageLog =
  models.LineMessageLog || model("LineMessageLog", LineMessageLogSchema);

export default LineMessageLog;
