import { useEffect, useState } from "react";

type Props = {
  images?: string[];
};

const imageModules = import.meta.glob(
  "../../public/images/scroll_highlights/*.{png,jpg,jpeg,svg}",
  { eager: true }
) as Record<string, { default: string }>;

const highlights = Object.entries(imageModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, mod]) => mod.default);

export default function ImageCarousel({ images = highlights }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (images.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <div className="scroll-container">
      <div
        className="scroll-track"
        style={{
          transform: `translateX(-${currentIndex * 100}%)`,
        }}
      >
        {images.map((img, i) => (
          <div
            key={i}
            className="scroll-image"
            style={{ backgroundImage: `url(${img})` }}
          />
        ))}
      </div>
    </div>
  );
}