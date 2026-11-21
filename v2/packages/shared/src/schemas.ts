import { z } from 'zod';
import { ScheduleRuleSchema } from './clinical.js';

export const SupportedLocaleSchema = z.enum(['id', 'en']);
export type SupportedLocale = z.infer<typeof SupportedLocaleSchema>;

export const GlobalRoleSchema = z.enum(['PATIENT', 'CAREGIVER', 'PHARMACIST', 'TENANT_ADMIN', 'SUPER_ADMIN']);
export type GlobalRole = z.infer<typeof GlobalRoleSchema>;

export const TenantRoleSchema = z.enum(['OWNER', 'TENANT_ADMIN', 'PHARMACIST', 'PHARMACY_TECH']);
export type TenantRole = z.infer<typeof TenantRoleSchema>;

export const VerificationStatusSchema = z.enum(['PENDING', 'VERIFIED', 'REJECTED']);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const TimeStringSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm');
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const RegisterSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().min(6).max(24).optional(),
    countryCode: z.string().length(2).toUpperCase().default('ID'),
    password: z.string().min(8).max(128),
    locale: SupportedLocaleSchema.default('id'),
    timezone: z.string().min(2).max(64).default('Asia/Jakarta'),
    consentAccepted: z.literal(true),
    consentVersion: z.string().default('2026-v2.0'),
    inviteCode: z.string().trim().max(40).optional(),
  })
  .refine((d) => Boolean(d.email || d.phone), {
    message: 'Email or phone number is required',
    path: ['email'],
  });

export const LoginSchema = z.object({
  login: z.string().trim().min(3).max(160),
  password: z.string().min(1).max(128),
  countryCode: z.string().length(2).toUpperCase().default('ID'),
  totpCode: z.string().length(6).optional(),
  transport: z.enum(['cookie', 'bearer']).default('cookie'),
});

export const CreateMedicationSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  activeIngredient: z.string().trim().max(200).nullable().optional(),
  drugCode: z.string().trim().max(64).nullable().optional(),
  drugCodeSystem: z.enum(['KFA', 'ATC', 'RXNORM', 'CUSTOM']).optional(),
  dosage: z.string().trim().max(100).nullable().optional(),
  strengthValue: z.number().positive().nullable().optional(),
  strengthUnit: z.string().trim().max(30).nullable().optional(),
  form: z.string().trim().max(80).nullable().optional(),
  instructions: z.string().trim().max(1000).nullable().optional(),
  times: z.array(TimeStringSchema).max(12).transform((a) => [...new Set(a)].sort()),
  scheduleRule: ScheduleRuleSchema.default({ type: 'DAILY', mealRelation: 'ANYTIME' }),
  startDate: IsoDateSchema.optional(),
  endDate: IsoDateSchema.nullable().optional(),
  articleId: z.string().nullable().optional(),
});

export const ConfirmDoseSchema = z.object({
  status: z.enum(['TAKEN', 'SKIPPED', 'PENDING']),
  note: z.string().trim().max(500).nullable().optional(),
  clientConfirmedAt: z.string().datetime().optional(),
});

export const RecordBloodPressureSchema = z
  .object({
    systolic: z.coerce.number().int().min(60).max(260),
    diastolic: z.coerce.number().int().min(30).max(160),
    pulse: z.coerce.number().int().min(30).max(220).nullable().optional(),
    measuredAt: z.string().datetime().optional(),
    note: z.string().trim().max(500).nullable().optional(),
    source: z.enum(['SELF', 'CLINIC', 'DEVICE']).optional(),
  })
  .refine((d) => d.systolic > d.diastolic, {
    message: 'Systolic pressure must be higher than diastolic pressure',
    path: ['systolic'],
  });

export const HealthParameterTypeSchema = z.enum([
  'WEIGHT',
  'BLOOD_GLUCOSE',
  'HEART_RATE',
  'SPO2',
  'TEMPERATURE',
  'FETAL_MOVEMENT',
  'EDEMA',
  'URINE_PROTEIN',
]);

export const RecordHealthParameterSchema = z.object({
  type: HealthParameterTypeSchema,
  value: z.coerce.number().finite().min(0).max(1500),
  unit: z.string().trim().min(1).max(30),
  context: z.string().trim().max(80).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  measuredAt: z.string().datetime().optional(),
  source: z.enum(['SELF', 'CLINIC', 'DEVICE']).optional(),
});

export const CreateCheckupReminderSchema = z.object({
  title: z.string().trim().min(2).max(200),
  type: z.enum(['CHECKUP', 'FOLLOW_UP', 'LAB_TEST', 'REFILL']).default('CHECKUP'),
  scheduledAt: z.string().datetime(),
  location: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const CreateFollowUpSchema = z.object({
  type: z.enum(['FOLLOW_UP', 'PTO_REPORT', 'COUNSELING', 'DRP_INTERVENTION']).default('PTO_REPORT'),
  subjective: z.string().trim().max(2500).nullable().optional(),
  objective: z.string().trim().max(2500).nullable().optional(),
  assessment: z.string().trim().max(2500).nullable().optional(),
  plan: z.string().trim().min(3).max(3000),
  drpCategory: z
    .enum([
      'NONE',
      'NON_ADHERENCE',
      'ADVERSE_DRUG_REACTION',
      'SUBOPTIMAL_DOSAGE',
      'DRUG_INTERACTION',
      'NEEDS_ADDITIONAL_THERAPY',
    ])
    .default('NONE'),
  recommendation: z.string().trim().max(2000).nullable().optional(),
  nextFollowUpDate: z.string().datetime().nullable().optional(),
  sendToChat: z.boolean().default(true),
  sendViaWhatsApp: z.boolean().default(false),
});

export const CreateAllergySchema = z.object({
  substanceName: z.string().trim().min(2).max(160),
  substanceCode: z.string().trim().max(64).nullable().optional(),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE', 'ANAPHYLAXIS']).default('MODERATE'),
  reaction: z.string().trim().max(500).nullable().optional(),
});

export const CreateCaregiverInviteSchema = z.object({
  caregiverPhone: z.string().trim().min(6).max(24).optional(),
  caregiverEmail: z.string().trim().toLowerCase().email().optional(),
  relationship: z.string().trim().min(2).max(80),
  canViewAdherence: z.boolean().default(true),
  receiveCriticalAlerts: z.boolean().default(true),
});
