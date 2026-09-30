export const createVercelBlobStore = async () => {
  const { put, del } = await import('@vercel/blob')
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw Object.assign(new Error('图片存储尚未配置。'), { code: 'ASSET_STORAGE_UNAVAILABLE', statusCode: 503 })
  return {
    putImage: async (pathname, bytes, contentType) => put(pathname, bytes, { access: 'public', addRandomSuffix: true, contentType, token: process.env.BLOB_READ_WRITE_TOKEN }),
    deleteImage: async (urlOrPathname) => del(urlOrPathname, { token: process.env.BLOB_READ_WRITE_TOKEN })
  }
}
