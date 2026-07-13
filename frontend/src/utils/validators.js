// src/utils/validators.js
export const isRequired = (value) => (value !== undefined && value !== null && String(value).trim() !== "" ? true : "This field is required");

export const isPhone = (value) => (/^\+?[0-9]{7,15}$/.test(value || "") ? true : "Enter a valid phone number");

export const isEmail = (value) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "") ? true : "Enter a valid email address");

export const isNationalId = (value) => (/^[0-9A-Za-z]{5,20}$/.test(value || "") ? true : "Enter a valid National ID");

export const minLength = (min) => (value) =>
  (value || "").length >= min ? true : `Must be at least ${min} characters`;

export const maxLength = (max) => (value) =>
  (value || "").length <= max ? true : `Must be at most ${max} characters`;

export const isPositiveNumber = (value) =>
  !isNaN(value) && Number(value) > 0 ? true : "Must be a positive number";

export const isNotFutureDate = (value) => {
  if (!value) return true;
  return new Date(value) <= new Date() ? true : "Date cannot be in the future";
};

export const passwordsMatch = (password) => (confirm) =>
  password === confirm ? true : "Passwords do not match";

export const composeValidators =
  (...validators) =>
  (value) => {
    for (const validate of validators) {
      const result = validate(value);
      if (result !== true) return result;
    }
    return true;
  };