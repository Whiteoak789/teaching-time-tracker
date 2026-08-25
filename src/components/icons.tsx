import * as Icons from "lucide-react";
import type { LucideProps } from "lucide-react";

const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  BookOpen: Icons.BookOpen, GraduationCap: Icons.GraduationCap, Users: Icons.Users,
  Coffee: Icons.Coffee, MessagesSquare: Icons.MessagesSquare, ClipboardList: Icons.ClipboardList,
  CheckSquare: Icons.SquareCheck, Eye: Icons.Eye, CircleAlert: Icons.CircleAlert,
  School: Icons.School, MoreHorizontal: Icons.Ellipsis, Calendar: Icons.Calendar,
};

export function CategoryIcon({ name, ...props }: LucideProps & { name: string }) {
  const Icon = iconMap[name] ?? Icons.Tag;
  return <Icon {...props} />;
}
