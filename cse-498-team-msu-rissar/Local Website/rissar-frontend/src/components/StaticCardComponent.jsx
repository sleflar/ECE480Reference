/**
 * Static Card Component
 * 
 * A simple card container with a title and content area.
 * Used for displaying static content or simple widgets.
 * 
 */
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function StaticCardComponent({ title, children }) {
  return (
    <Card className="flex flex-col h-full w-full overflow-hidden">
      {/* Optional title header */}
      {title && (
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      {/* Content area */}
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {children}
      </CardContent>
    </Card>
  );
}