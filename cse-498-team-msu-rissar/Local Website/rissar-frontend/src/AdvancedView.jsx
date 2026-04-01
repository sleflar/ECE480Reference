/**
 * AdvancedView
 * 
 * Grid-based dashboard view that allows users to configure and arrange multiple components.
 * Supports dynamic grid resizing and card swapping.
 * 
 */
import CardComponent from "./components/CardComponent";
import { useFullscreen } from "./utils/FullscreenContext";

export default function AdvancedView({ gridColumns, gridRows, cardConfigurations, onCardConfigChange }) {
  const { fullscreenCardIndex, isFullscreen } = useFullscreen();
  const cardCount = gridColumns * gridRows;

  const handleCardSwap = (indexA, indexB) => {
    const valueA = cardConfigurations[indexA];
    const valueB = cardConfigurations[indexB];

    onCardConfigChange(indexA, valueB);
    onCardConfigChange(indexB, valueA);
  };

  // If a card is fullscreened, render only that card in fullscreen mode
  if (isFullscreen && fullscreenCardIndex !== null) {
    return (
      <div className="p-2 sm:p-2 md:p-2 h-[calc(100dvh-60px)] w-full box-border flex flex-col overflow-hidden bg-white dark:bg-black">
        <div className="h-full w-full rounded-lg bg-white dark:bg-[#181818] border border-brand-green/20 flex flex-col overflow-hidden">
          <CardComponent
            value={cardConfigurations[fullscreenCardIndex] || "None"}
            onChange={(value) => onCardConfigChange(fullscreenCardIndex, value)}
            cardIndex={fullscreenCardIndex}
            gridColumns={gridColumns}
            cardCount={cardCount}
            onCardSwap={handleCardSwap}
          />
        </div>
      </div>
    );
  }

  // Normal grid view
  return (
    <div className="p-2 sm:p-2 md:p-2 h-[calc(100dvh-60px)] w-full box-border flex flex-col overflow-hidden bg-white dark:bg-black">
      <div className="advanced-view-grid flex flex-col md:grid gap-2 sm:gap-2 h-full w-full box-border overflow-y-auto md:overflow-hidden">
        <style>{`
          @media (min-width: 768px) {
            .advanced-view-grid {
              grid-template-columns: repeat(${gridColumns}, 1fr);
              grid-template-rows: repeat(${gridRows}, 1fr);
            }
          }
        `}</style>
        {Array.from({ length: cardCount }, (_, index) => (
          <div key={index} className="rounded-lg bg-white dark:bg-[#181818] border border-brand-green/20 flex flex-col min-h-[300px] md:min-h-0 overflow-hidden">
            <CardComponent
              value={cardConfigurations[index] || "None"}
              onChange={(value) => onCardConfigChange(index, value)}
              cardIndex={index}
              gridColumns={gridColumns}
              cardCount={cardCount}
              onCardSwap={handleCardSwap}
            />
          </div>
        ))}
      </div>
    </div>
  );
}