'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Instrument, InstrumentType } from '@/types/database';
import { InstrumentSchema, InstrumentInput } from '@/lib/validations/instrument';
import InstrumentTypeSelector from './instrument-type-selector';

interface InstrumentFormProps {
  mode?: 'create' | 'edit';
  initialData?: Instrument;
}

export default function InstrumentForm({
  mode = 'create',
  initialData,
}: InstrumentFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<InstrumentInput>({
    instrument_type: initialData?.instrument_type || 'ELECTRONIC_WEIGHING',
    manufacturer: initialData?.manufacturer || '',
    model: initialData?.model || '',
    serial_number: initialData?.serial_number || '',
    accuracy_class: initialData?.accuracy_class || 'Class III',
    max_capacity: initialData?.max_capacity ?? 15,
    min_capacity: initialData?.min_capacity ?? 0.1,
    verification_interval_e: initialData?.verification_interval_e ?? 5,
    actual_interval_d: initialData?.actual_interval_d ?? 5,
    unit: initialData?.unit || 'kg',
    status: initialData?.status || 'ACTIVE',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (serverError) setServerError(null);
  };

  const handleTypeChange = (type: InstrumentType) => {
    setFormData((prev) => ({ ...prev, instrument_type: type }));
    if (errors.instrument_type) {
      setErrors((prev) => ({ ...prev, instrument_type: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);

    // Validate with Zod
    const validationResult = InstrumentSchema.safeParse(formData);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      validationResult.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const supabase = createClient();

      if (mode === 'create') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('instruments') as any).insert({
          instrument_type: validationResult.data.instrument_type,
          manufacturer: validationResult.data.manufacturer,
          model: validationResult.data.model,
          serial_number: validationResult.data.serial_number,
          accuracy_class: validationResult.data.accuracy_class,
          max_capacity: validationResult.data.max_capacity,
          min_capacity: validationResult.data.min_capacity,
          verification_interval_e: validationResult.data.verification_interval_e,
          actual_interval_d: validationResult.data.actual_interval_d,
          unit: validationResult.data.unit,
          status: validationResult.data.status,
        });

        if (error) {
          if (error.code === '23505' || error.message.includes('serial_number')) {
            setServerError(
              `An instrument with serial number "${validationResult.data.serial_number}" is already registered.`
            );
          } else {
            setServerError(error.message);
          }
          setSubmitting(false);
          return;
        }

        router.push('/dashboard/instruments?success=registered');
        router.refresh();
      } else if (mode === 'edit' && initialData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('instruments') as any)
          .update({
            instrument_type: validationResult.data.instrument_type,
            manufacturer: validationResult.data.manufacturer,
            model: validationResult.data.model,
            serial_number: validationResult.data.serial_number,
            accuracy_class: validationResult.data.accuracy_class,
            max_capacity: validationResult.data.max_capacity,
            min_capacity: validationResult.data.min_capacity,
            verification_interval_e: validationResult.data.verification_interval_e,
            actual_interval_d: validationResult.data.actual_interval_d,
            unit: validationResult.data.unit,
            status: validationResult.data.status,
          })
          .eq('id', initialData.id);

        if (error) {
          if (error.code === '23505' || error.message.includes('serial_number')) {
            setServerError(
              `An instrument with serial number "${validationResult.data.serial_number}" already exists.`
            );
          } else {
            setServerError(error.message);
          }
          setSubmitting(false);
          return;
        }

        router.push(`/dashboard/instruments/${initialData.id}?success=updated`);
        router.refresh();
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      setServerError(errorMessage);
      setSubmitting(false);
    }
  };

  const isElectronic = formData.instrument_type === 'ELECTRONIC_WEIGHING';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {serverError && (
        <div className="p-4 text-sm text-red-700 bg-red-100 dark:bg-red-950/50 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-900">
          {serverError}
        </div>
      )}

      {/* 1. Instrument Profile Type Selection */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
            1
          </span>
          Instrument Profile Type
        </h3>
        <InstrumentTypeSelector
          value={formData.instrument_type}
          onChange={handleTypeChange}
          disabled={submitting}
        />
        {errors.instrument_type && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {errors.instrument_type}
          </p>
        )}
      </div>

      {/* 2. Device Identification & Information */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
            2
          </span>
          Device Identification
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label
              htmlFor="manufacturer"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Manufacturer <span className="text-red-500">*</span>
            </label>
            <input
              id="manufacturer"
              name="manufacturer"
              type="text"
              value={formData.manufacturer}
              onChange={handleChange}
              placeholder={
                isElectronic
                  ? 'e.g. Mettler Toledo, ESSAE, Citizen'
                  : 'e.g. Avery India, Eagle, Systems India'
              }
              className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-sm"
            />
            {errors.manufacturer && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.manufacturer}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="model"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Model Name / Number <span className="text-red-500">*</span>
            </label>
            <input
              id="model"
              name="model"
              type="text"
              value={formData.model}
              onChange={handleChange}
              placeholder={isElectronic ? 'e.g. DS-852, ME204' : 'e.g. BBA236, PS-500'}
              className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-sm"
            />
            {errors.model && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.model}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="serial_number"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Unique Serial Number <span className="text-red-500">*</span>
            </label>
            <input
              id="serial_number"
              name="serial_number"
              type="text"
              value={formData.serial_number}
              onChange={handleChange}
              placeholder="e.g. SN-2026-88492"
              className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 font-mono text-sm"
            />
            {errors.serial_number && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.serial_number}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 3. Instrument-Specific Technical Specifications */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
              3
            </span>
            {isElectronic
              ? 'Electronic Weighing Instrument Specifications'
              : 'Platform Weighing Scale Specifications'}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 pl-8">
            {isElectronic
              ? 'Configure electronic counter, precision balance accuracy class, and digital parameters.'
              : 'Configure industrial platform scale accuracy class, heavy load parameters, and frame capacity.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label
              htmlFor="accuracy_class"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Accuracy Class <span className="text-red-500">*</span>
            </label>
            <select
              id="accuracy_class"
              name="accuracy_class"
              value={formData.accuracy_class}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-sm"
            >
              <option value="Class I">Class I (Special Accuracy)</option>
              <option value="Class II">Class II (High Accuracy)</option>
              <option value="Class III">Class III (Medium Accuracy)</option>
              <option value="Class IIII">Class IIII (Ordinary Accuracy)</option>
            </select>
            {errors.accuracy_class && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.accuracy_class}
              </p>
            )}
          </div>

          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg text-xs space-y-1">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 block">
              {isElectronic
                ? 'Electronic Profile Note'
                : 'Platform Profile Note'}
            </span>
            <p className="text-zinc-500 dark:text-zinc-400">
              {isElectronic
                ? 'Electronic weighing instruments use digital load cells or electromagnetic force compensation sensors for precision measurement.'
                : 'Platform weighing scales utilize heavy-duty strain gauge load cells mounted under steel or cast-iron platforms.'}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Capacity & Scale Intervals */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
            4
          </span>
          Capacity &amp; Scale Intervals (e / d)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label
              htmlFor="max_capacity"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Max Capacity (Max) <span className="text-red-500">*</span>
            </label>
            <input
              id="max_capacity"
              name="max_capacity"
              type="number"
              step="any"
              value={formData.max_capacity ?? ''}
              onChange={handleChange}
              placeholder={isElectronic ? 'e.g. 15' : 'e.g. 500'}
              className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-sm"
            />
            {errors.max_capacity && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.max_capacity}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="min_capacity"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Min Capacity (Min) <span className="text-red-500">*</span>
            </label>
            <input
              id="min_capacity"
              name="min_capacity"
              type="number"
              step="any"
              value={formData.min_capacity ?? ''}
              onChange={handleChange}
              placeholder={isElectronic ? 'e.g. 0.1' : 'e.g. 2'}
              className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-sm"
            />
            {errors.min_capacity && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.min_capacity}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="unit"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Unit of Measurement <span className="text-red-500">*</span>
            </label>
            <select
              id="unit"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-sm"
            >
              <option value="kg">Kilogram (kg)</option>
              <option value="g">Gram (g)</option>
              <option value="mg">Milligram (mg)</option>
              <option value="t">Tonne (t)</option>
            </select>
            {errors.unit && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.unit}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="verification_interval_e"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Verification Scale Interval (e) <span className="text-red-500">*</span>
            </label>
            <input
              id="verification_interval_e"
              name="verification_interval_e"
              type="number"
              step="any"
              value={formData.verification_interval_e ?? ''}
              onChange={handleChange}
              placeholder="e.g. 5"
              className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-sm"
            />
            {errors.verification_interval_e && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.verification_interval_e}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="actual_interval_d"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Actual Scale Interval (d) <span className="text-red-500">*</span>
            </label>
            <input
              id="actual_interval_d"
              name="actual_interval_d"
              type="number"
              step="any"
              value={formData.actual_interval_d ?? ''}
              onChange={handleChange}
              placeholder="e.g. 5"
              className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-sm"
            />
            {errors.actual_interval_d && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.actual_interval_d}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 5. Operational Status */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
            5
          </span>
          Operational Status
        </h3>

        <div className="max-w-xs space-y-1">
          <label
            htmlFor="status"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Current Status <span className="text-red-500">*</span>
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-sm"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="UNDER_INSPECTION">UNDER_INSPECTION</option>
          </select>
          {errors.status && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {errors.status}
            </p>
          )}
        </div>
      </div>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Link
          href={
            mode === 'edit' && initialData
              ? `/dashboard/instruments/${initialData.id}`
              : '/dashboard/instruments'
          }
          className="px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {submitting
            ? mode === 'create'
              ? 'Registering...'
              : 'Saving...'
            : mode === 'create'
            ? `Register ${
                isElectronic ? 'Electronic Instrument' : 'Platform Scale'
              }`
            : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
