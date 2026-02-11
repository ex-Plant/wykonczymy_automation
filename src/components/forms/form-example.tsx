'use client'

import { Button } from '@/components/ui/button'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from '@/components/ui/field'
import { SelectItem } from '@/components/ui/select'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'

import { XIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toastMessage } from '@/components/toasts'
import { useAppForm, useStore } from './hooks/form-hooks'
import { PROJECT_STAGES, cartSchema, type CartSchemaT } from './schemas_example/cart-schema'
import useSyncFormStore from './hooks/use-sync-form-store'
import useCartStore from './stores_example/cart-store'
import useCheckFormErrors from './hooks/use-check-form-errors'
import FormFooter from './form-footer'

export default function FormExample() {
  const form = useAppForm({
    defaultValues: {
      company_name: '',
      email: '',
      nip: '',
      project_stage: '',
      consents: {
        consent1: false,
        consent2: false,
      },

      users: [],
    } satisfies CartSchemaT as CartSchemaT,
    validators: {
      onSubmit: cartSchema,
    },
    onSubmit: async (data) => {
      console.log('🚀 formData: ', data.value)
      toastMessage('ok')
      // prevent resetting form
      return false
    },
  })
  console.log(form)

  const { updateFormData } = useCartStore()
  const formValues = useStore(form.store, (state) => state.values)

  useSyncFormStore(updateFormData, formValues)
  useCheckFormErrors(form)

  return (
    <form.AppForm>
      <form
        className="container mx-auto my-6 px-4"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <FieldGroup>
          <form.AppField name="company_name">
            {(field) => <field.Input label="Nazwa firmy" placeholder="Nazwa firmy" />}
          </form.AppField>
          <form.AppField name="email">
            {(field) => <field.Input type={`email`} placeholder={'E-mail'} />}
          </form.AppField>

          <form.Field name="nip">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <Input
                    placeholder={'NIP'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    aria-invalid={isInvalid}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '')
                      if (value.length <= 10) {
                        field.handleChange(value)
                      }
                    }}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          </form.Field>
          <form.AppField name="project_stage">
            {(field) => (
              <field.Select placeholder={'Etap projektu'}>
                {PROJECT_STAGES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>

          <FieldSet>
            <FieldContent>
              <FieldLegend>Consents</FieldLegend>
              <FieldDescription>Please accept all required consents</FieldDescription>
            </FieldContent>
            <FieldGroup data-slot="checkbox-group">
              <form.AppField name="consents.consent1">
                {(field) => <field.Checkbox label="Rules" />}
              </form.AppField>
              <form.AppField name="consents.consent2">
                {(field) => <field.Checkbox label="Privacy Policy" />}
              </form.AppField>
            </FieldGroup>
          </FieldSet>

          <FieldSeparator />

          <form.Field name="users" mode="array">
            {(field) => {
              return (
                <FieldSet>
                  <div className="flex items-center justify-between gap-2">
                    <FieldContent>
                      <FieldLegend variant="label" className="mb-0">
                        User Email Addresses
                      </FieldLegend>
                      <FieldDescription>
                        Add up to 5 users to this project (including yourself).
                      </FieldDescription>
                      {field.state.meta.errors && <FieldError errors={field.state.meta.errors} />}
                    </FieldContent>
                    <Button
                      type="button"
                      variant="outline"
                      size="fest"
                      onClick={() => field.pushValue({ email: '' })}
                    >
                      Add User
                    </Button>
                  </div>
                  <FieldGroup>
                    {field.state.value.map((_, index) => (
                      <form.Field key={index} name={`users[${index}].email`}>
                        {(innerField) => {
                          const isInvalid =
                            innerField.state.meta.isTouched && !innerField.state.meta.isValid
                          return (
                            <Field orientation="horizontal" data-invalid={isInvalid}>
                              <FieldContent>
                                <InputGroup>
                                  <InputGroupInput
                                    id={innerField.name}
                                    aria-invalid={isInvalid}
                                    aria-label={`User ${index + 1} email`}
                                    type="email"
                                    onBlur={innerField.handleBlur}
                                    onChange={(e) => innerField.handleChange(e.target.value)}
                                    value={innerField.state.value}
                                  />
                                  {field.state.value.length > 1 && (
                                    <InputGroupAddon align="inline-end">
                                      <InputGroupButton
                                        type="button"
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => field.removeValue(index)}
                                        aria-label={`Remove User ${index + 1}`}
                                      >
                                        <XIcon />
                                      </InputGroupButton>
                                    </InputGroupAddon>
                                  )}
                                </InputGroup>
                                {isInvalid && <FieldError errors={innerField.state.meta.errors} />}
                              </FieldContent>
                            </Field>
                          )
                        }}
                      </form.Field>
                    ))}
                  </FieldGroup>
                </FieldSet>
              )
            }}
          </form.Field>
        </FieldGroup>
        <FormFooter />
      </form>
    </form.AppForm>
  )
}
