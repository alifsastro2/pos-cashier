'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { ImagePlus, X, Loader2 } from 'lucide-react'
import { ImageCropModal } from './image-crop-modal'

interface ImageUploadProps {
  value: string | null
  onChange: (url: string | null) => void
  defaultSrc?: string
  label?: string
  className?: string
  enableCrop?: boolean
  aspectRatio?: number
}

export function ImageUpload({
  value,
  onChange,
  defaultSrc,
  label = 'Upload Gambar',
  className = '',
  enableCrop = false,
  aspectRatio = 1,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const displaySrc = value || defaultSrc || null

  async function uploadBlob(blob: Blob) {
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', blob, 'image.jpg')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Upload gagal')
      onChange(data.url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload gagal')
    } finally {
      setUploading(false)
    }
  }

  async function handleFile(file: File) {
    if (enableCrop) {
      const reader = new FileReader()
      reader.onload = () => setCropSrc(reader.result as string)
      reader.readAsDataURL(file)
    } else {
      await uploadBlob(file)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  return (
    <>
      <div className={`space-y-1.5 ${className}`}>
        {label && (
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{label}</label>
        )}
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="relative w-full h-32 rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-800 flex items-center justify-center cursor-pointer hover:border-orange-500/60 hover:bg-zinc-800/80 transition-colors overflow-hidden group"
        >
          {displaySrc ? (
            <>
              <Image
                src={displaySrc}
                alt="preview"
                fill
                className="object-cover"
                unoptimized
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ImagePlus className="w-6 h-6 text-white" />
              </div>
              {value && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onChange(null) }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-black transition-colors z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </>
          ) : uploading ? (
            <div className="flex flex-col items-center gap-2 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs">Mengupload...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-500">
              <ImagePlus className="w-6 h-6" />
              <span className="text-xs">{label} (klik atau drag & drop)</span>
              {enableCrop && <span className="text-[10px] text-zinc-600">Foto akan di-crop otomatis</span>}
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleInput}
            className="hidden"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <p className="text-xs text-zinc-600">JPG, PNG, WebP · Maks. 5MB</p>
      </div>

      {cropSrc && (
        <ImageCropModal
          open={!!cropSrc}
          imageSrc={cropSrc}
          aspectRatio={aspectRatio}
          onConfirm={async (blob) => {
            setCropSrc(null)
            await uploadBlob(blob)
          }}
          onClose={() => setCropSrc(null)}
        />
      )}
    </>
  )
}
