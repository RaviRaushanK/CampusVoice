export default function RatingChoice({ name, value, onChange }) {
  return <div className="cv-rating-options">{[1, 2, 3, 4, 5].map(rating => <label className="cv-rating-option" key={rating}>
    <input type="radio" name={name} checked={value === rating} onChange={() => onChange(rating)} />
    <span><i className="bi bi-star-fill" aria-hidden="true" />{rating}</span>
  </label>)}</div>;
}
