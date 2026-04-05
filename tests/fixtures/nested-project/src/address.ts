/**
 * @publish
 * Represents a physical mailing address.
 */
export interface Address {
  /** Street name and number. */
  street: string;
  /** City or town. */
  city: string;
  /** ISO 3166-1 alpha-2 country code, e.g. "US" or "DE". */
  country: string;
  /** Postal or ZIP code. */
  postalCode: string;
}
