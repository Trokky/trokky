import { useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import type { MediaFieldValue } from '@trokky/trokky/types'
import { createStudioLogger } from '../../../utils/logger'
import type { StudioContext } from '../../base/FieldPlugin'

const logger = createStudioLogger('RichTextField')

interface UseRichTextImagesOptions {
  editor: Editor | null
  studioContext: StudioContext | undefined
  selectedImageNode: any
  setSelectedImageNode: (node: any) => void
  availableVariants: Record<string, any>
  setAvailableVariants: (variants: Record<string, any>) => void
  setShowImageToolbar: (show: boolean) => void
}

/**
 * Images inside the rich text editor: inserting one from the media browser,
 * switching its variant, reading back which variant it is on, and deleting it.
 * The Trokky data attributes are what the shortcode conversion reads, so every
 * path here keeps them in step with the src.
 */
export function useRichTextImages({
  editor,
  studioContext,
  selectedImageNode,
  setSelectedImageNode,
  availableVariants,
  setAvailableVariants,
  setShowImageToolbar,
}: UseRichTextImagesOptions) {
  // Handle image selection from media browser
  const handleImageSelected = useCallback(
    (selectedValue: MediaFieldValue) => {
      if (!editor || !selectedValue?.asset?._ref) {
        return
      }

      const assetId = selectedValue.asset._ref
      let altText = selectedValue.alt || ''

      // Get the media metadata for alt text fallback
      if (studioContext?.apiClient) {
        studioContext.apiClient
          .getMediaById(assetId)
          .then(response => {
            if (response.success && response.data?.file) {
              const mediaFile = response.data.file

              // Use metadata alt text if no alt text was provided
              if (!selectedValue.alt) {
                altText = mediaFile.metadata?.alt || mediaFile.filename || ''
              }

              // 🎯 NEW APPROACH: Insert image with data attributes for shortcode conversion
              let imageUrl: string = ''
              if (studioContext?.mediaUrlGenerator) {
                // Generate URL for Studio display (users see real image)
                imageUrl = studioContext.mediaUrlGenerator.getMediaUrl(
                  assetId,
                  selectedValue.variant && selectedValue.variant !== 'original'
                    ? selectedValue.variant
                    : undefined
                )
              } else if (studioContext?.apiClient?.getMediaUrl) {
                // Fallback to apiClient if MediaUrlGenerator not available
                imageUrl = studioContext.apiClient.getMediaUrl(
                  assetId,
                  selectedValue.variant && selectedValue.variant !== 'original'
                    ? selectedValue.variant
                    : undefined
                )
              } else {
                // Fallback URL generation
                imageUrl = mediaFile.url
              }

              // Insert image with special data attributes for shortcode identification
              const imageAttrs = {
                src: imageUrl,
                alt: altText,
                title: altText,
                'data-trokky-id': assetId,
                ...(selectedValue.variant &&
                  selectedValue.variant !== 'original' && {
                    'data-trokky-variant': selectedValue.variant,
                  }),
                // Add default styling for rich text images
                class: 'max-w-full h-auto rounded-lg',
              }

              // Insert the image into the editor with data attributes
              editor.chain().focus().setImage(imageAttrs).run()

              logger.info('Image inserted with shortcode data', {
                imageUrl,
                altText,
                assetId,
                variant: selectedValue.variant,
                shortcodeReady: true,
              })
            } else {
              logger.error('Invalid media metadata response', response)
            }
          })
          .catch(error => {
            logger.error('Failed to load image asset', error)
          })
      } else {
        logger.warn('No Studio context available for image URL resolution')
      }
    },
    [editor, studioContext?.apiClient, studioContext?.mediaUrlGenerator, logger]
  )

  // Handle variant change for selected image
  const handleVariantChange = useCallback(
    (variantName: string) => {
      if (!editor || !selectedImageNode) return

      // Get trokky-id from existing data attributes (preferred) or extract from URL
      const trokkyId = selectedImageNode.attrs['data-trokky-id']
      const imageSrc = selectedImageNode.attrs.src
      let assetId = trokkyId

      // Fallback: extract from URL if no trokky-id
      if (!assetId) {
        const assetIdMatch = imageSrc.match(/\/media\/([^\/]+)/)
        assetId = assetIdMatch?.[1]
      }

      if (assetId && studioContext?.mediaUrlGenerator) {
        // Generate new URL using MediaUrlGenerator or apiClient
        let newImageUrl: string
        if (studioContext.mediaUrlGenerator) {
          newImageUrl =
            variantName === 'original'
              ? studioContext.mediaUrlGenerator.getMediaUrl(assetId)
              : studioContext.mediaUrlGenerator.getMediaUrl(
                  assetId,
                  variantName
                )
        } else if (studioContext.apiClient?.getMediaUrl) {
          newImageUrl =
            variantName === 'original'
              ? studioContext.apiClient.getMediaUrl(assetId)
              : studioContext.apiClient.getMediaUrl(assetId, variantName)
        } else {
          console.error('No URL generator available for media')
          return
        }

        // Update image attributes including data attributes for shortcode conversion
        const newAttrs = {
          src: newImageUrl,
          'data-trokky-id': assetId,
          ...(variantName !== 'original' && {
            'data-trokky-variant': variantName,
          }),
        }

        // Remove variant data attribute if original is selected
        if (
          variantName === 'original' &&
          selectedImageNode.attrs['data-trokky-variant']
        ) {
          // Need to explicitly remove the attribute
          editor
            .chain()
            .focus()
            .updateAttributes('image', {
              ...newAttrs,
              'data-trokky-variant': null,
            })
            .run()
        } else {
          editor.chain().focus().updateAttributes('image', newAttrs).run()
        }

        // Update the selected image node in state
        setSelectedImageNode({
          ...selectedImageNode,
          attrs: {
            ...selectedImageNode.attrs,
            ...newAttrs,
          },
        })

        logger.debug('Image variant changed with shortcode data', {
          assetId,
          variant: variantName,
          newUrl: newImageUrl,
          hasDataAttributes: true,
        })
      } else if (assetId) {
        // Fallback to URL manipulation (legacy approach when no MediaUrlGenerator)
        let newImageUrl: string
        if (variantName === 'original') {
          newImageUrl = imageSrc.replace(/\/variants\/[^\/]+/, '/file')
        } else {
          const variantData = availableVariants[variantName]
          if (variantData?.url) {
            newImageUrl = variantData.url
          } else {
            logger.warn(`Variant '${variantName}' not found`)
            return
          }
        }

        editor
          .chain()
          .focus()
          .updateAttributes('image', { src: newImageUrl })
          .run()
        setSelectedImageNode({
          ...selectedImageNode,
          attrs: { ...selectedImageNode.attrs, src: newImageUrl },
        })

        logger.debug('Image variant changed (legacy URL manipulation)', {
          assetId,
          variant: variantName,
          newUrl: newImageUrl,
        })
      } else {
        logger.warn('No asset ID found for variant change')
      }
    },
    [editor, selectedImageNode, availableVariants, logger, studioContext]
  )

  // Get current variant from image node (prefer data attributes, fallback to URL)
  const getCurrentVariant = useCallback((imageNode: any) => {
    // First, try to get variant from data attribute (shortcode system)
    if (imageNode?.attrs?.['data-trokky-variant']) {
      return imageNode.attrs['data-trokky-variant']
    }

    // Fallback: parse from URL (legacy system)
    const imageSrc = imageNode?.attrs?.src || ''
    if (imageSrc.includes('/variants/')) {
      const variantMatch = imageSrc.match(/\/variants\/([^\/]+)/)
      return variantMatch ? variantMatch[1] : 'original'
    }

    return 'original'
  }, [])

  // Handle image deletion
  const handleDeleteImage = useCallback(() => {
    if (!editor) return

    editor.chain().focus().deleteSelection().run()
    setShowImageToolbar(false)
    setSelectedImageNode(null)
    setAvailableVariants({})

    logger.info('Image deleted')
  }, [editor, logger])
  return {
    handleImageSelected,
    handleVariantChange,
    getCurrentVariant,
    handleDeleteImage,
  }
}
