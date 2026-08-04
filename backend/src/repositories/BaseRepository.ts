export abstract class BaseRepository<T> {
  protected modelDelegate: Record<string, Function>;

  constructor(modelDelegate: unknown) {
    this.modelDelegate = modelDelegate as Record<string, Function>;
  }

  async findById(id: string): Promise<T | null> {
    return this.modelDelegate.findUnique({
      where: { id },
    });
  }

  async findAll(params?: {
    where?: unknown;
    orderBy?: unknown;
    skip?: number;
    take?: number;
  }): Promise<T[]> {
    return this.modelDelegate.findMany({
      where: params?.where,
      orderBy: params?.orderBy,
      skip: params?.skip,
      take: params?.take,
    });
  }

  async create(data: unknown): Promise<T> {
    return this.modelDelegate.create({
      data,
    });
  }

  async update(id: string, data: unknown): Promise<T> {
    return this.modelDelegate.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<T> {
    return this.modelDelegate.delete({
      where: { id },
    });
  }

  async count(where?: unknown): Promise<number> {
    return this.modelDelegate.count({ where });
  }
}
