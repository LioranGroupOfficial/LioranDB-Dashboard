import { Document, Model, Schema, model, models, Types } from '../adapter';

export interface IFreeInstanceNameReservation extends Document {
  _id: Types.ObjectId;
  name: string;
  ownerId: Types.ObjectId;
  requestKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const FreeInstanceNameReservationSchema = new Schema<IFreeInstanceNameReservation>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestKey: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true },
);

const FreeInstanceNameReservation: Model<IFreeInstanceNameReservation> =
  models.FreeInstanceNameReservation ||
  model<IFreeInstanceNameReservation>('FreeInstanceNameReservation', FreeInstanceNameReservationSchema);

export default FreeInstanceNameReservation;
