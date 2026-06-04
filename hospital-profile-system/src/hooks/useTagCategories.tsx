import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '@/services/api';

interface TagCategoryItem {
  name: string;
  icon: string;
  tags: string[];
}

interface TagCategoriesContextValue {
  categories: Record<string, TagCategoryItem>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateCategories: (cats: Record<string, TagCategoryItem>) => Promise<void>;
}

const TagCategoriesContext = createContext<TagCategoriesContextValue | null>(null);

export function TagCategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Record<string, TagCategoryItem>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const data = await apiService.getTagCategories();
      setCategories(data.categories);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const updateCategories = async (cats: Record<string, TagCategoryItem>) => {
    await apiService.updateTagCategories(cats);
    setCategories(cats);
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <TagCategoriesContext.Provider value={{ categories, loading, error, refresh, updateCategories }}>
      {children}
    </TagCategoriesContext.Provider>
  );
}

export function useTagCategories() {
  const ctx = useContext(TagCategoriesContext);
  if (!ctx) throw new Error('useTagCategories must be used inside TagCategoriesProvider');
  return ctx;
}

// Fallback default categories (used before API response arrives)
export const DEFAULT_TAG_CATEGORIES: Record<string, TagCategoryItem> = {
  personality: {
    name: '性格特征',
    icon: '👤',
    tags: ['脾气大','脾气温和','容易急躁','有耐心','易怒','配合度高','不配合','挑剔','随和','固执','健谈','内向','表达清晰','表达含糊','积极','消极','焦虑','乐观'],
  },
  consumption: {
    name: '消费能力',
    icon: '💰',
    tags: ['高消费','中消费','低消费','价格敏感','主动咨询高端服务','无所谓','自费','医保','商业保险','专家号需求','普通门诊'],
  },
  health: {
    name: '健康状况',
    icon: '🏥',
    tags: ['腿脚不便','轮椅需求','行动正常','行动受限','需要陪同','独自就诊','子女代为咨询','了解病情','不了解病情','常客','新患者'],
  },
  preference: {
    name: '服务偏好',
    icon: '⭐',
    tags: ['VIP需求','需要特别关注','普通服务即可','快速响应','正常响应','不着急','高投诉风险','低投诉风险','高复诊意愿','低复诊意愿'],
  },
};
