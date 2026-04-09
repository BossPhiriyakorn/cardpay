import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * เทมเพลต Flex สำหรับสร้างแคมเปญแบบกรอกฟิลด์ — อนาคตเชื่อมกับฟอร์มสร้างแคมเปญ/โฆษณา
 *
 * คอลเลกชัน: `flexcampaigntemplates`
 * - fieldsSpecJson: อาร์เรย์นิยามฟิลด์ (ข้อความ/รูป)
 * - flexSkeletonJson: โครง Flex ที่มี placeholder {{key}} ตรงกับฟิลด์
 */
const FlexCampaignTemplateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: { type: String, default: "", trim: true },
    /** JSON string: [{ "key": "headline", "type": "text"|"textarea"|"image", "labelTh": "...", "required": true, "order": 0 }] */
    fieldsSpecJson: { type: String, required: true, default: "[]" },
    /** JSON string: LINE Flex (bubble) — แทนที่ข้อความด้วย {{key}} */
    flexSkeletonJson: { type: String, required: true, default: "{}" },
  },
  { timestamps: true, versionKey: false }
);

export type FlexCampaignTemplateDocument = InferSchemaType<typeof FlexCampaignTemplateSchema>;

const FlexCampaignTemplate =
  models.FlexCampaignTemplate || model("FlexCampaignTemplate", FlexCampaignTemplateSchema);

export default FlexCampaignTemplate;
