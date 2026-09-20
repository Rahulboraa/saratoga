import { Schema, model } from 'mongoose'

const propertySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    location: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const Property = model('Property', propertySchema)
