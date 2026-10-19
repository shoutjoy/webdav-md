export function slotImages(slot) {
  if (Array.isArray(slot.backgroundImages)) return slot.backgroundImages;
  return slot.backgroundImage ? [{ id: 'legacy', src: slot.backgroundImage, name: '배경 이미지', duration: 3 }] : [];
}

export function imageTimeline(images, totalDuration, mode = 'equal') {
  if (!images.length || !(totalDuration > 0)) return [];
  let time = 0;
  return images.map((image, index) => {
    const duration = mode === 'custom' ? Math.max(.1, Number(image.duration) || 3) : totalDuration / images.length;
    const start = time;
    time = index === images.length - 1 ? totalDuration : Math.min(totalDuration, time + duration);
    return { ...image, start, end: time };
  }).filter(image => image.end > image.start);
}

export function imageAtTime(timeline, seconds) {
  return timeline.find(image => seconds < image.end) || timeline[timeline.length - 1];
}

export function drawContained(context, image, width, height) {
  const sourceWidth = image.videoWidth || image.naturalWidth || image.width;
  const sourceHeight = image.videoHeight || image.naturalHeight || image.height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const w = sourceWidth * scale, h = sourceHeight * scale;
  context.fillStyle = '#000'; context.fillRect(0, 0, width, height);
  context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
}
