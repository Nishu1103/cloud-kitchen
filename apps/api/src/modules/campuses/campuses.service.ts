import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppException } from '@/common/exceptions/app.exception';
import { Campus, type CampusDocument } from '@/database/schemas';
import type { CreateCampusDto, CreateZoneDto, UpdateCampusDto } from './dto/campus.dto';

/**
 * Campuses are the tenant root: adding a university is a document here plus its zones,
 * not a deployment. Zones are embedded because they are always read with the campus and
 * are far too few to justify a collection.
 */
@Injectable()
export class CampusesService {
  constructor(@InjectModel(Campus.name) private readonly campusModel: Model<CampusDocument>) {}

  /** What an anonymous visitor needs to render the storefront shell. */
  async publicBySlug(slug: string) {
    const campus = await this.campusModel
      .findOne({ slug, isActive: true })
      .select('name slug city timezone currency logoUrl themeColor branding supportEmail supportPhone zones')
      .lean();
    if (!campus) throw AppException.notFound('Campus');

    return {
      ...campus,
      id: String(campus._id),
      // Inactive zones are an operational detail, not something a shopper should see.
      zones: (campus.zones ?? [])
        .filter((zone) => zone.isActive)
        .map((zone) => ({
          id: String(zone._id),
          name: zone.name,
          deliveryFee: zone.deliveryFee,
          etaMinutes: zone.etaMinutes,
        })),
    };
  }

  async listPublic() {
    return this.campusModel
      .find({ isActive: true })
      .select('name slug city logoUrl themeColor')
      .sort({ name: 1 })
      .lean();
  }

  async findById(campusId: string) {
    const campus = await this.campusModel.findById(new Types.ObjectId(campusId)).lean();
    if (!campus) throw AppException.notFound('Campus');
    return campus;
  }

  async listAll() {
    return this.campusModel.find().sort({ createdAt: -1 }).lean();
  }

  async create(dto: CreateCampusDto, createdBy: string) {
    const exists = await this.campusModel.exists({ slug: dto.slug });
    if (exists) throw AppException.conflict('That campus slug is already taken.');

    const campus = await this.campusModel.create({
      ...dto,
      isActive: dto.isActive ?? true,
      createdBy: new Types.ObjectId(createdBy),
    });
    return campus.toJSON();
  }

  async update(campusId: string, dto: UpdateCampusDto) {
    const campus = await this.campusModel.findByIdAndUpdate(
      new Types.ObjectId(campusId),
      { $set: dto },
      { new: true, runValidators: true },
    );
    if (!campus) throw AppException.notFound('Campus');
    return campus.toJSON();
  }

  async listZones(campusId: string) {
    const campus = await this.campusModel
      .findById(new Types.ObjectId(campusId))
      .select('zones')
      .lean();
    if (!campus) throw AppException.notFound('Campus');
    return campus.zones ?? [];
  }

  async createZone(campusId: string, dto: CreateZoneDto) {
    const campus = await this.campusModel.findById(new Types.ObjectId(campusId));
    if (!campus) throw AppException.notFound('Campus');

    if (campus.zones.some((zone) => zone.name.toLowerCase() === dto.name.toLowerCase())) {
      throw AppException.conflict('A zone with that name already exists.');
    }

    campus.zones.push({
      name: dto.name,
      deliveryFee: dto.deliveryFee,
      etaMinutes: dto.etaMinutes,
      boundary: dto.polygon ? { type: 'Polygon', coordinates: [dto.polygon] } : undefined,
      isActive: dto.isActive ?? true,
    } as never);

    await campus.save();
    return campus.zones;
  }

  async updateZone(campusId: string, zoneId: string, dto: Partial<CreateZoneDto>) {
    const campus = await this.campusModel.findById(new Types.ObjectId(campusId));
    if (!campus) throw AppException.notFound('Campus');

    const zone = campus.zones.find((entry) => String(entry._id) === zoneId);
    if (!zone) throw AppException.notFound('Zone');

    if (dto.name !== undefined) zone.name = dto.name;
    if (dto.deliveryFee !== undefined) zone.deliveryFee = dto.deliveryFee;
    if (dto.etaMinutes !== undefined) zone.etaMinutes = dto.etaMinutes;
    if (dto.isActive !== undefined) zone.isActive = dto.isActive;
    if (dto.polygon) zone.boundary = { type: 'Polygon', coordinates: [dto.polygon] };

    await campus.save();
    return zone;
  }
}
