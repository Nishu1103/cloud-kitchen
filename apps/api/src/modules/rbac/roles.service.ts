import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ERROR_CODES, SYSTEM_ROLES, type Permission } from '@ck/types';
import { Model, Types } from 'mongoose';
import { AppException } from '@/common/exceptions/app.exception';
import { Role, User, type RoleDocument, type UserDocument } from '@/database/schemas';
import { AuthorizationService } from './authorization.service';
import type { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

/**
 * Roles are data, so operators can compose permissions without a deploy. Two
 * invariants are enforced here: system roles cannot be reshaped or deleted, and no
 * operator can grant a permission they do not themselves hold (privilege escalation).
 */
@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly authorization: AuthorizationService,
  ) {}

  async list(campusId: string) {
    return this.roleModel
      .find({ $or: [{ campusId: null }, { campusId: new Types.ObjectId(campusId) }] })
      .sort({ isSystem: -1, name: 1 })
      .lean();
  }

  async create(campusId: string, dto: CreateRoleDto, actorPermissions: Permission[]) {
    this.assertNoEscalation(dto.permissions, actorPermissions);

    const existing = await this.roleModel.exists({
      slug: dto.slug,
      campusId: new Types.ObjectId(campusId),
    });
    if (existing) throw AppException.conflict('A role with this slug already exists.');

    return this.roleModel.create({
      slug: dto.slug,
      name: dto.name,
      description: dto.description,
      permissions: dto.permissions,
      campusId: new Types.ObjectId(campusId),
      isSystem: false,
    });
  }

  async update(roleId: string, dto: UpdateRoleDto, actorPermissions: Permission[]) {
    const role = await this.roleModel.findById(roleId);
    if (!role) throw AppException.notFound('Role');

    if (role.isSystem && dto.permissions) {
      throw AppException.forbidden(
        'System role permissions are fixed. Create a custom role instead.',
      );
    }
    if (dto.permissions) this.assertNoEscalation(dto.permissions, actorPermissions);

    if (dto.name !== undefined) role.name = dto.name;
    if (dto.description !== undefined) role.description = dto.description;
    if (dto.permissions) role.permissions = dto.permissions;
    await role.save();

    await this.authorization.invalidateAll();
    return role.toJSON();
  }

  async remove(roleId: string) {
    const role = await this.roleModel.findById(roleId);
    if (!role) throw AppException.notFound('Role');
    if (role.isSystem) throw AppException.forbidden('System roles cannot be deleted.');

    const assigned = await this.userModel.countDocuments({ roleIds: role._id });
    if (assigned > 0) {
      throw AppException.conflict(
        `This role is assigned to ${assigned} user(s). Reassign them before deleting.`,
      );
    }

    await role.deleteOne();
    await this.authorization.invalidateAll();
  }

  async assignToUser(
    campusId: string,
    userId: string,
    roleIds: string[],
    actorPermissions: Permission[],
    actorId: string,
  ) {
    if (userId === actorId) {
      throw AppException.forbidden('You cannot change your own roles.');
    }

    const user = await this.userModel.findOne({
      _id: new Types.ObjectId(userId),
      campusId: new Types.ObjectId(campusId),
    });
    if (!user) throw AppException.notFound('User');

    const objectIds = roleIds.map((id) => new Types.ObjectId(id));
    const roles = await this.roleModel
      .find({
        _id: { $in: objectIds },
        $or: [{ campusId: null }, { campusId: new Types.ObjectId(campusId) }],
      })
      .lean();

    if (roles.length !== roleIds.length) {
      throw AppException.badRequest(
        ERROR_CODES.VALIDATION_FAILED,
        'One or more roles do not exist on this campus.',
      );
    }

    // Only a super-admin may mint another super-admin.
    const grantsSuperAdmin = roles.some((role) => role.slug === SYSTEM_ROLES.SUPER_ADMIN);
    if (grantsSuperAdmin && !actorPermissions.includes('user:impersonate')) {
      throw AppException.forbidden('Only a super admin can grant the super admin role.');
    }

    const granted = roles.flatMap((role) => role.permissions);
    this.assertNoEscalation(granted, actorPermissions);

    user.roleIds = objectIds;
    await user.save();
    await this.authorization.invalidateUser(userId);

    return { userId, roleIds };
  }

  /**
   * An operator can only hand out permissions they already hold. Without this,
   * anyone with `role:manage` could write themselves a role containing
   * `order:refund` and drain the platform.
   */
  private assertNoEscalation(requested: Permission[], actorPermissions: Permission[]): void {
    const held = new Set(actorPermissions);
    const escalated = [...new Set(requested)].filter((permission) => !held.has(permission));
    if (escalated.length) {
      throw AppException.forbidden(
        `You cannot grant permissions you do not hold: ${escalated.join(', ')}.`,
      );
    }
  }
}
