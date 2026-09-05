import { z } from 'zod';

export const InstrumentSchema = z.object({
  instrument_type: z.enum(['ELECTRONIC_WEIGHING', 'PLATFORM_WEIGHING'], {
    message: 'Please select a valid instrument type',
  }),
  manufacturer: z
    .string()
    .min(1, { message: 'Manufacturer is required' })
    .trim(),
  model: z.string().min(1, { message: 'Model is required' }).trim(),
  serial_number: z
    .string()
    .min(1, { message: 'Serial number is required' })
    .trim(),
  accuracy_class: z
    .string()
    .min(1, { message: 'Accuracy class is required' })
    .trim(),
  max_capacity: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z
      .number({ message: 'Max capacity must be a valid number' })
      .positive({ message: 'Max capacity must be greater than 0' })
  ),
  min_capacity: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z
      .number({ message: 'Min capacity must be a valid number' })
      .nonnegative({ message: 'Min capacity cannot be negative' })
  ),
  verification_interval_e: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z
      .number({ message: 'Verification interval (e) must be a valid number' })
      .positive({ message: 'Verification interval (e) must be greater than 0' })
  ),
  actual_interval_d: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z
      .number({ message: 'Actual interval (d) must be a valid number' })
      .positive({ message: 'Actual interval (d) must be greater than 0' })
  ),
  unit: z.string().min(1, { message: 'Unit of measurement is required' }).trim(),
  status: z
    .enum(['ACTIVE', 'INACTIVE', 'UNDER_INSPECTION'])
    .default('ACTIVE'),
});

export type InstrumentInput = z.infer<typeof InstrumentSchema>;

