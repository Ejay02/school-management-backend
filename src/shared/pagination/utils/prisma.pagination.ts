import { PaginationParams, PaginatedResponse } from '../types/pagination.types';

export class PrismaQueryBuilder {
  static buildPaginationQuery(params: PaginationParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 10));
    const skip = (page - 1) * limit;

    const query: any = {
      take: limit,
      skip,
    };

    if (params.sortBy) {
      query.orderBy = {
        [params.sortBy]: params.sortOrder || 'desc',
      };
    }

    return query;
  }

  static buildSearchQuery(search: string | undefined, searchFields: string[]) {
    if (!search) return {};

    return {
      OR: searchFields.map((field) => ({
        [field]: {
          contains: search,
          mode: 'insensitive',
        },
      })),
    };
  }

  static async paginateResponse<T>(
    model: any,
    baseQuery: any,
    params: PaginationParams,
    searchFields?: string[],
  ): Promise<PaginatedResponse<T>> {
    const paginationQuery = this.buildPaginationQuery(params);
    const searchQuery = this.buildSearchQuery(
      params.search,
      searchFields || [],
    );

    const [total, data] = await Promise.all([
      model.count({
        where: {
          ...baseQuery.where,
          ...searchQuery,
        },
      }),
      model.findMany({
        ...baseQuery,
        ...paginationQuery,
        where: {
          ...baseQuery.where,
          ...searchQuery,
        },
      }),
    ]);

    const lastPage = Math.ceil(total / paginationQuery.take);

    return {
      data,
      meta: {
        total,
        page: params.page || 1,
        lastPage,
        limit: paginationQuery.take,
      },
    };
  }
}
