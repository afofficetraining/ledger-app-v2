export default function BrandMark({ size = 28 }) {
  return (
    <span className="brand-mark">
      <img src="/logo-icon.png" alt="Gold Edge Ventures" height={size} style={{ height: size, width: 'auto' }} />
      Gold Edge Ventures
    </span>
  );
}
