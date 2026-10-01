export const assetGenerationButton = ({ generating, hasAsset, ready }) => ({
  label: generating ? '生成中…' : hasAsset ? '重新拆解资源提示词' : '生成资源提示词',
  disabled: generating || !ready
})

export const characterArchiveStatus = () => '已保存到当前浏览器'
